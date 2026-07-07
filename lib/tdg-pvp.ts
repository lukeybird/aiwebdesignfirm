import { initDatabase, sql } from '@/lib/db';
import { pusher } from '@/lib/pusher';

export type TdgQueueRow = {
  id: number;
  session_token: string;
  player_name: string;
  status: string;
  room_id: string | null;
  player_slot: number | null;
  opponent_name: string | null;
  opponent_token: string | null;
  last_seen_at?: string | Date | null;
  match_started_at?: number | null;
};

/** Waiting players must ping within this window or get removed from the queue. */
export const TDG_WAITING_ALIVE_SECONDS = 30;
/** Matched rows with no activity are treated as abandoned. */
export const TDG_MATCHED_ALIVE_SECONDS = 120;
/** Server-authoritative PvP tick duration (ms). */
export const TDG_TICK_MS = 50;
/** Inputs are scheduled a few ticks ahead to absorb jitter. */
export const TDG_INPUT_DELAY_TICKS = 2;

export async function ensureTdgPvpTables() {
  await initDatabase();
}

export async function touchQueueSession(token: string) {
  await sql`
    UPDATE tdg_pvp_queue
    SET last_seen_at = CURRENT_TIMESTAMP
    WHERE session_token = ${token}
  `;
}

export async function cleanupStaleTdgQueue() {
  await sql`
    DELETE FROM tdg_pvp_queue
    WHERE status = 'waiting'
      AND last_seen_at < NOW() - INTERVAL '30 seconds'
  `;
  await sql`
    DELETE FROM tdg_pvp_queue
    WHERE status = 'matched'
      AND last_seen_at < NOW() - INTERVAL '2 minutes'
  `;
}

export async function findQueueRowByToken(token: string) {
  const rows = (await sql`
    SELECT id, session_token, player_name, status, room_id, player_slot, opponent_name, opponent_token, last_seen_at, match_started_at
    FROM tdg_pvp_queue
    WHERE session_token = ${token}
    LIMIT 1
  `) as unknown as TdgQueueRow[];
  return rows[0] ?? null;
}

export async function isQueueSessionAlive(row: TdgQueueRow) {
  if (!row.last_seen_at) return false;
  const rows = row.status === 'waiting'
    ? ((await sql`
        SELECT 1
        FROM tdg_pvp_queue
        WHERE session_token = ${row.session_token}
          AND last_seen_at >= NOW() - INTERVAL '30 seconds'
        LIMIT 1
      `) as unknown as Array<Record<string, never>>)
    : ((await sql`
        SELECT 1
        FROM tdg_pvp_queue
        WHERE session_token = ${row.session_token}
          AND last_seen_at >= NOW() - INTERVAL '2 minutes'
        LIMIT 1
      `) as unknown as Array<Record<string, never>>);
  return rows.length > 0;
}

export async function deleteRoomById(roomId: string) {
  await sql`
    DELETE FROM tdg_pvp_actions
    WHERE room_id = ${roomId}
  `;
  await sql`
    DELETE FROM tdg_pvp_queue
    WHERE room_id = ${roomId}
  `;
}

export async function removeQueueSession(token: string) {
  const row = await findQueueRowByToken(token);
  if (!row) return null;

  if (row.room_id) {
    await deleteRoomById(row.room_id);
    return row;
  }

  await sql`
    DELETE FROM tdg_pvp_queue
    WHERE session_token = ${token}
  `;
  return row;
}

export async function notifyOpponentSessionEnded(row: TdgQueueRow, event: string, payload: Record<string, unknown>) {
  if (!row.opponent_token) return;
  try {
    await pusher.trigger(`tdg-player-${row.opponent_token}`, event, payload);
  } catch (error) {
    console.warn('tdg-pvp opponent notify failed:', error);
  }
}

export async function verifyRoomPlayer(roomId: string, sessionToken: string) {
  const rows = (await sql`
    SELECT player_slot, player_name, status
    FROM tdg_pvp_queue
    WHERE room_id = ${roomId}
      AND session_token = ${sessionToken}
      AND status = 'matched'
    LIMIT 1
  `) as unknown as Array<{ player_slot: number; player_name: string; status: string }>;
  return rows[0] ?? null;
}

export async function getRoomStartMs(roomId: string) {
  const rows = (await sql`
    SELECT match_started_at
    FROM tdg_pvp_queue
    WHERE room_id = ${roomId}
      AND status = 'matched'
    LIMIT 1
  `) as unknown as Array<{ match_started_at: number | null }>;
  return rows[0]?.match_started_at ?? null;
}

export async function currentServerTick(roomId: string) {
  const startMs = await getRoomStartMs(roomId);
  if (!startMs) return 0;
  return Math.max(0, Math.floor((Date.now() - startMs) / TDG_TICK_MS));
}
