'use strict';

const { AuthoritativeMatch, TICK_MS } = require('./sim/authoritative');

class GameRoom {
  constructor({ roomId, startsAt, names }) {
    this.roomId = roomId;
    this.sockets = [null, null]; // WebSocket per slot
    this.tokens = [null, null];
    this.match = new AuthoritativeMatch({
      roomId,
      startsAt,
      players: [{ name: names?.[0] || 'Player 1' }, { name: names?.[1] || 'Player 2' }],
    });
    this.tickTimer = null;
    this.closed = false;
    this.matchCompletePosted = false;
  }

  isFull() {
    return !!(this.sockets[0] && this.sockets[1]);
  }

  attach(slot, ws, sessionToken, playerName) {
    if (slot !== 0 && slot !== 1) return { ok: false, error: 'Bad slot' };
    if (this.sockets[slot] && this.sockets[slot] !== ws && this.sockets[slot].readyState === 1) {
      try {
        this.sockets[slot].close(4000, 'Replaced by new connection');
      } catch {
        // ignore
      }
    }
    this.sockets[slot] = ws;
    this.tokens[slot] = sessionToken;
    if (playerName) this.match.players[slot].name = playerName;
    this.match.setConnected(slot, true);
    ws.__tdgSlot = slot;
    ws.__tdgRoomId = this.roomId;
    return { ok: true };
  }

  detach(ws) {
    const slot = ws.__tdgSlot;
    if (slot !== 0 && slot !== 1) return;
    if (this.sockets[slot] === ws) {
      this.sockets[slot] = null;
      this.match.setConnected(slot, false);
    }
  }

  send(slot, obj) {
    const ws = this.sockets[slot];
    if (!ws || ws.readyState !== 1) return;
    try {
      ws.send(JSON.stringify(obj));
    } catch (err) {
      console.warn('send failed', this.roomId, slot, err.message);
    }
  }

  broadcast(obj, exceptSlot = null) {
    for (let i = 0; i < 2; i++) {
      if (i === exceptSlot) continue;
      this.send(i, obj);
    }
  }

  startTicking(onMatchOver) {
    if (this.tickTimer) return;
    this.tickTimer = setInterval(() => {
      if (this.closed) return;
      const msg = this.match.step();
      this.broadcast(msg);
      if (msg.matchOver && !this.matchCompletePosted) {
        this.matchCompletePosted = true;
        onMatchOver?.(this, msg.matchOver);
      }
    }, TICK_MS);
  }

  stopTicking() {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }

  close() {
    this.closed = true;
    this.stopTicking();
    for (const ws of this.sockets) {
      if (ws && ws.readyState === 1) {
        try {
          ws.close(1000, 'Room closed');
        } catch {
          // ignore
        }
      }
    }
    this.sockets = [null, null];
  }
}

class RoomManager {
  constructor() {
    this.rooms = new Map();
  }

  getOrCreate(roomId, { startsAt, names } = {}) {
    let room = this.rooms.get(roomId);
    if (!room) {
      room = new GameRoom({ roomId, startsAt, names });
      this.rooms.set(roomId, room);
    }
    return room;
  }

  get(roomId) {
    return this.rooms.get(roomId) || null;
  }

  delete(roomId) {
    const room = this.rooms.get(roomId);
    if (room) {
      room.close();
      this.rooms.delete(roomId);
    }
  }

  stats() {
    return {
      rooms: this.rooms.size,
      players: [...this.rooms.values()].reduce(
        (n, r) => n + (r.sockets[0] ? 1 : 0) + (r.sockets[1] ? 1 : 0),
        0,
      ),
    };
  }
}

module.exports = { RoomManager, GameRoom };
