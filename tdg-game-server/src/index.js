'use strict';

const http = require('http');
const { WebSocketServer } = require('ws');
const { authenticateJoin } = require('./auth');
const { RoomManager } = require('./room');

const PORT = Number(process.env.PORT) || 8080;
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const MATCH_WEBHOOK_URL = process.env.VERCEL_MATCH_WEBHOOK_URL || '';
const MATCH_WEBHOOK_SECRET = process.env.TDG_WEBHOOK_SECRET || process.env.TDG_JOIN_SECRET || '';

const rooms = new RoomManager();

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
    'Access-Control-Allow-Origin': CORS_ORIGIN,
  });
  res.end(payload);
}

async function postMatchComplete(room, result) {
  if (!MATCH_WEBHOOK_URL) {
    console.log('match over (no webhook configured)', room.roomId, result);
    return;
  }
  const token = room.tokens.find(Boolean);
  if (!token) return;
  try {
    const res = await fetch(MATCH_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(MATCH_WEBHOOK_SECRET ? { 'X-TDG-Webhook-Secret': MATCH_WEBHOOK_SECRET } : {}),
      },
      body: JSON.stringify({
        roomId: room.roomId,
        sessionToken: token,
        winnerSlot: result.winnerSlot,
        endReason: result.endReason,
        source: 'tdg-game-server',
      }),
    });
    if (!res.ok) {
      console.warn('match-complete webhook failed', res.status);
    }
  } catch (err) {
    console.warn('match-complete webhook error', err.message);
  }
}

function safeParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': CORS_ORIGIN,
      'Access-Control-Allow-Methods': 'GET,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  if (req.url === '/health' || req.url === '/') {
    sendJson(res, 200, {
      ok: true,
      service: 'tdg-game-server',
      ...rooms.stats(),
      ts: Date.now(),
    });
    return;
  }

  sendJson(res, 404, { error: 'Not found' });
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.send(
    JSON.stringify({
      type: 'hello',
      service: 'tdg-game-server',
      t: Date.now(),
    }),
  );

  ws.on('message', async (data) => {
    const msg = safeParse(typeof data === 'string' ? data : data.toString());
    if (!msg || typeof msg !== 'object') {
      ws.send(JSON.stringify({ type: 'error', error: 'Invalid JSON' }));
      return;
    }

    try {
      await handleMessage(ws, msg);
    } catch (err) {
      console.error('message handler error', err);
      ws.send(JSON.stringify({ type: 'error', error: 'Internal error' }));
    }
  });

  ws.on('close', () => {
    const roomId = ws.__tdgRoomId;
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;
    room.detach(ws);
    room.broadcast({
      type: 'peer_disconnect',
      slot: ws.__tdgSlot,
      t: Date.now(),
    });
  });
});

async function handleMessage(ws, msg) {
  switch (msg.type) {
    case 'join': {
      const auth = await authenticateJoin({
        ticket: msg.ticket,
        roomId: msg.roomId,
        sessionToken: msg.sessionToken,
      });
      if (!auth.ok) {
        ws.send(JSON.stringify({ type: 'error', error: auth.error || 'Join denied' }));
        ws.close(4001, 'Unauthorized');
        return;
      }
      const claims = auth.claims;
      const room = rooms.getOrCreate(claims.roomId, {
        startsAt: claims.startsAt,
        names: [],
      });
      const names = room.match.players.map((p) => p.name);
      names[claims.playerSlot] = claims.playerName;
      if (claims.opponentName) {
        const other = claims.playerSlot === 0 ? 1 : 0;
        if (!names[other] || names[other].startsWith('Player')) {
          names[other] = claims.opponentName;
          room.match.players[other].name = claims.opponentName;
        }
      }
      room.match.players[claims.playerSlot].name = claims.playerName;
      if (claims.startsAt) room.match.startsAt = claims.startsAt;

      const attached = room.attach(claims.playerSlot, ws, claims.sessionToken, claims.playerName);
      if (!attached.ok) {
        ws.send(JSON.stringify({ type: 'error', error: attached.error }));
        return;
      }

      ws.send(
        JSON.stringify({
          type: 'joined',
          roomId: claims.roomId,
          playerSlot: claims.playerSlot,
          playerName: claims.playerName,
          startsAt: room.match.startsAt,
          serverAuth: true,
        }),
      );

      if (room.isFull()) {
        room.broadcast({
          type: 'match_ready',
          roomId: room.roomId,
          startsAt: room.match.startsAt,
          players: room.match.players.map((p) => ({ name: p.name })),
          serverAuth: true,
        });
        room.startTicking((r, result) => {
          void postMatchComplete(r, result);
          setTimeout(() => rooms.delete(r.roomId), 30_000);
        });
      }
      return;
    }

    case 'input': {
      const room = rooms.get(ws.__tdgRoomId);
      if (!room) {
        ws.send(JSON.stringify({ type: 'error', error: 'Not in a room' }));
        return;
      }
      const slot = ws.__tdgSlot;
      const result = room.match.enqueueInput(slot, msg);
      if (!result.ok) {
        ws.send(JSON.stringify({ type: 'error', error: result.error }));
      }
      return;
    }

    case 'forfeit': {
      const room = rooms.get(ws.__tdgRoomId);
      if (!room) return;
      const result = room.match.forfeit(ws.__tdgSlot);
      if (result) {
        room.broadcast({
          type: 'forfeit',
          from: result.from,
          winnerSlot: result.winnerSlot,
          endReason: result.endReason,
          t: Date.now(),
        });
        // Next tick will emit matchOver; force a step message immediately.
        const tick = room.match.step();
        room.broadcast(tick);
        if (tick.matchOver && !room.matchCompletePosted) {
          room.matchCompletePosted = true;
          void postMatchComplete(room, tick.matchOver);
        }
      }
      return;
    }

    case 'checksum': {
      const room = rooms.get(ws.__tdgRoomId);
      if (!room) return;
      room.match.reportChecksum(ws.__tdgSlot, msg.report || msg);
      return;
    }

    case 'ping': {
      ws.send(JSON.stringify({ type: 'pong', t: Date.now(), clientT: msg.t }));
      return;
    }

    default:
      ws.send(JSON.stringify({ type: 'error', error: `Unknown type: ${msg.type}` }));
  }
}

// Drop dead connections
const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    try {
      ws.ping();
    } catch {
      // ignore
    }
  }
}, 25_000);

wss.on('close', () => clearInterval(heartbeat));

server.listen(PORT, () => {
  console.log(`tdg-game-server listening on :${PORT}`);
  console.log(`health: http://localhost:${PORT}/health`);
});
