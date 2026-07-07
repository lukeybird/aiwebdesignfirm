import { initDatabase, sql } from '@/lib/db';

export type TdgQueueRow = {
  id: number;
  session_token: string;
  player_name: string;
  status: string;
  room_id: string | null;
  player_slot: number | null;
  opponent_name: string | null;
  opponent_token: string | null;
};

export async function ensureTdgPvpTables() {
  await initDatabase();
}

export async function cleanupStaleTdgQueue() {
  await sql`
    DELETE FROM tdg_pvp_queue
    WHERE status = 'waiting'
      AND created_at < NOW() - INTERVAL '3 minutes'
  `;
}

export async function findQueueRowByToken(token: string) {
  const rows = (await sql`
    SELECT id, session_token, player_name, status, room_id, player_slot, opponent_name, opponent_token
    FROM tdg_pvp_queue
    WHERE session_token = ${token}
    LIMIT 1
  `) as unknown as TdgQueueRow[];
  return rows[0] ?? null;
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
