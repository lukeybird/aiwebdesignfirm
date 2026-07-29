import { randomBytes } from 'crypto';
import { sql } from '@/lib/db';
import { safeTrigger } from '@/lib/pusher';
import { recordMatchStart } from '@/lib/tdg-pvp-activity';
import {
  cleanupStaleTdgQueue,
  ensureTdgPvpTables,
  findQueueRowByToken,
  touchQueueSession,
} from '@/lib/tdg-pvp';

export const TFT_LOBBY_MAX = 4;
export const TFT_LOBBY_MIN_START = 2;

export type TftLobbyMember = {
  sessionToken: string;
  playerName: string;
  playerSlot: number;
  lastSeenAt: string | Date;
};

function makeRoomId() {
  return randomBytes(12).toString('hex');
}

export async function listTftLobbyMembers(roomId: string): Promise<TftLobbyMember[]> {
  const rows = (await sql`
    SELECT session_token, player_name, player_slot, last_seen_at
    FROM tdg_pvp_queue
    WHERE room_id = ${roomId}
      AND status IN ('waiting_tft', 'matched_tft')
      AND last_seen_at >= NOW() - INTERVAL '45 seconds'
      AND player_slot IS NOT NULL
    ORDER BY player_slot ASC
  `) as unknown as Array<{
    session_token: string;
    player_name: string;
    player_slot: number;
    last_seen_at: string | Date;
  }>;

  return rows.map((r) => ({
    sessionToken: r.session_token,
    playerName: r.player_name,
    playerSlot: Number(r.player_slot),
    lastSeenAt: r.last_seen_at,
  }));
}

export function lobbyPublicPayload(roomId: string, members: TftLobbyMember[], started = false) {
  return {
    roomId,
    count: members.length,
    max: TFT_LOBBY_MAX,
    minStart: TFT_LOBBY_MIN_START,
    canStartEarly: !started && members.length >= TFT_LOBBY_MIN_START && members.length < TFT_LOBBY_MAX,
    started,
    players: members.map((m) => ({
      slot: m.playerSlot,
      name: m.playerName,
    })),
  };
}

async function broadcastLobby(roomId: string, members: TftLobbyMember[], event: string, extra: Record<string, unknown> = {}) {
  const lobby = lobbyPublicPayload(roomId, members, event === 'match_found');
  await Promise.all(
    members.map((m) =>
      safeTrigger(`tdg-player-${m.sessionToken}`, event, {
        ...lobby,
        ...extra,
        playerId: m.playerSlot,
        isHost: isLobbyHost(m.playerSlot, members),
        tft: true,
      }),
    ),
  );
}

function isLobbyHost(slot: number, members: TftLobbyMember[]) {
  if (!members.length) return slot === 0;
  return slot === Math.min(...members.map((m) => m.playerSlot));
}

export async function findOpenTftLobby(): Promise<{ roomId: string; members: TftLobbyMember[] } | null> {
  const rows = (await sql`
    SELECT room_id
    FROM tdg_pvp_queue
    WHERE status = 'waiting_tft'
      AND room_id IS NOT NULL
      AND last_seen_at >= NOW() - INTERVAL '45 seconds'
    GROUP BY room_id
    HAVING COUNT(*) < ${TFT_LOBBY_MAX}
    ORDER BY MIN(created_at) ASC
    LIMIT 1
  `) as unknown as Array<{ room_id: string }>;

  if (!rows[0]?.room_id) return null;
  const members = await listTftLobbyMembers(rows[0].room_id);
  if (members.length >= TFT_LOBBY_MAX) return null;
  return { roomId: rows[0].room_id, members };
}

export async function joinTftLobby(params: {
  name: string;
  sessionToken: string;
}): Promise<{
  status: 'waiting' | 'matched';
  sessionToken: string;
  playerName: string;
  playerId: number;
  isHost: boolean;
  roomId: string;
  lobby: ReturnType<typeof lobbyPublicPayload>;
  startsAt?: number;
  joinTicket?: string | null;
  serverAuth?: boolean;
  tft: true;
}> {
  await ensureTdgPvpTables();
  await cleanupStaleTdgQueue();

  const existing = await findQueueRowByToken(params.sessionToken);
  if (existing?.status === 'matched_tft' && existing.room_id != null && existing.player_slot != null) {
    const members = await listTftLobbyMembers(existing.room_id);
    const lobby = lobbyPublicPayload(existing.room_id, members, true);
    return {
      status: 'matched',
      sessionToken: params.sessionToken,
      playerName: existing.player_name,
      playerId: existing.player_slot,
      isHost: isLobbyHost(existing.player_slot, members),
      roomId: existing.room_id,
      lobby,
      tft: true,
    };
  }

  if (existing?.status === 'waiting_tft' && existing.room_id != null && existing.player_slot != null) {
    await touchQueueSession(params.sessionToken);
    const members = await listTftLobbyMembers(existing.room_id);
    const lobby = lobbyPublicPayload(existing.room_id, members, false);
    await broadcastLobby(existing.room_id, members, 'lobby_update');
    return {
      status: 'waiting',
      sessionToken: params.sessionToken,
      playerName: params.name,
      playerId: existing.player_slot,
      isHost: isLobbyHost(existing.player_slot, members),
      roomId: existing.room_id,
      lobby,
      tft: true,
    };
  }

  const open = await findOpenTftLobby();
  let roomId: string;
  let slot: number;
  let members: TftLobbyMember[];

  if (open) {
    roomId = open.roomId;
    const used = new Set(open.members.map((m) => m.playerSlot));
    slot = 0;
    while (used.has(slot) && slot < TFT_LOBBY_MAX) slot += 1;
    if (slot >= TFT_LOBBY_MAX) {
      roomId = makeRoomId();
      slot = 0;
    }
  } else {
    roomId = makeRoomId();
    slot = 0;
  }

  await sql`
    INSERT INTO tdg_pvp_queue (
      session_token, player_name, status, room_id, player_slot, opponent_name, opponent_token, last_seen_at
    ) VALUES (
      ${params.sessionToken}, ${params.name}, 'waiting_tft', ${roomId}, ${slot}, NULL, NULL, CURRENT_TIMESTAMP
    )
    ON CONFLICT (session_token) DO UPDATE SET
      player_name = EXCLUDED.player_name,
      status = 'waiting_tft',
      room_id = EXCLUDED.room_id,
      player_slot = EXCLUDED.player_slot,
      opponent_name = NULL,
      opponent_token = NULL,
      created_at = CURRENT_TIMESTAMP,
      last_seen_at = CURRENT_TIMESTAMP
  `;

  members = await listTftLobbyMembers(roomId);
  await broadcastLobby(roomId, members, 'lobby_update');

  if (members.length >= TFT_LOBBY_MAX) {
    return startTftLobby(roomId, params.sessionToken);
  }

  const me = members.find((m) => m.sessionToken === params.sessionToken) || members[slot];
  const mySlot = me?.playerSlot ?? slot;
  return {
    status: 'waiting',
    sessionToken: params.sessionToken,
    playerName: params.name,
    playerId: mySlot,
    isHost: isLobbyHost(mySlot, members),
    roomId,
    lobby: lobbyPublicPayload(roomId, members, false),
    tft: true,
  };
}

export async function startTftLobby(roomId: string, requesterToken: string) {
  const members = await listTftLobbyMembers(roomId);
  if (members.length < TFT_LOBBY_MIN_START) {
    throw Object.assign(new Error(`Need at least ${TFT_LOBBY_MIN_START} players to start.`), { status: 400 });
  }

  const requester = members.find((m) => m.sessionToken === requesterToken);
  if (!requester) {
    throw Object.assign(new Error('Not in this lobby.'), { status: 403 });
  }
  // Lobby host can start early; anyone can trigger when full.
  if (members.length < TFT_LOBBY_MAX && !isLobbyHost(requester.playerSlot, members)) {
    throw Object.assign(new Error('Only the lobby host can start early.'), { status: 403 });
  }

  await sql`
    UPDATE tdg_pvp_queue
    SET status = 'matched_tft',
        last_seen_at = CURRENT_TIMESTAMP
    WHERE room_id = ${roomId}
      AND status = 'waiting_tft'
  `;

  const locked = await listTftLobbyMembers(roomId);
  const startsAt = Date.now() + 4500;
  const p0 = locked.find((m) => m.playerSlot === 0)?.playerName || locked[0]?.playerName || 'P1';
  const p1 = locked.find((m) => m.playerSlot === 1)?.playerName || locked[1]?.playerName || 'P2';
  await recordMatchStart(roomId, p0, p1);

  const lobby = lobbyPublicPayload(roomId, locked, true);
  const roster = locked.map((o) => ({ slot: o.playerSlot, name: o.playerName }));

  // TFT multi uses Pusher host-authority sync (game WS is still 1v1).
  await Promise.all(
    locked.map(async (m) => {
      await safeTrigger(`tdg-player-${m.sessionToken}`, 'match_found', {
        ...lobby,
        roomId,
        startsAt,
        playerId: m.playerSlot,
        isHost: isLobbyHost(m.playerSlot, locked),
        opponentName: locked.filter((o) => o.playerSlot !== m.playerSlot).map((o) => o.playerName).join(', '),
        roster,
        joinTicket: null,
        serverAuth: false,
        tft: true,
        limited: false,
      });
    }),
  );

  const me = locked.find((m) => m.sessionToken === requesterToken) || requester;

  return {
    status: 'matched' as const,
    sessionToken: me.sessionToken,
    playerName: me.playerName,
    playerId: me.playerSlot,
    isHost: isLobbyHost(me.playerSlot, locked),
    roomId,
    lobby,
    startsAt,
    joinTicket: null,
    serverAuth: false,
    tft: true as const,
    roster,
  };
}

/** Remove a waiting TFT lobby member and refresh the remaining lobby. */
export async function leaveTftLobby(sessionToken: string) {
  const row = await findQueueRowByToken(sessionToken);
  if (!row || row.status !== 'waiting_tft' || !row.room_id) return null;
  const roomId = row.room_id;
  await sql`DELETE FROM tdg_pvp_queue WHERE session_token = ${sessionToken}`;
  const members = await listTftLobbyMembers(roomId);
  if (members.length) await broadcastLobby(roomId, members, 'lobby_update');
  return { roomId, lobby: lobbyPublicPayload(roomId, members, false) };
}

export async function tftLobbySnapshotForToken(sessionToken: string) {
  const row = await findQueueRowByToken(sessionToken);
  if (!row?.room_id) return null;
  if (row.status !== 'waiting_tft' && row.status !== 'matched_tft') return null;
  const members = await listTftLobbyMembers(row.room_id);
  return {
    status: row.status === 'matched_tft' ? 'matched' : 'waiting',
    roomId: row.room_id,
    playerId: row.player_slot,
    isHost: isLobbyHost(Number(row.player_slot), members),
    lobby: lobbyPublicPayload(row.room_id, members, row.status === 'matched_tft'),
  };
}
