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
};

/** Waiting players must ping within this window or get removed from the queue. */
export const TDG_WAITING_ALIVE_SECONDS = 30;
/** Cancel an active match when any player misses heartbeats for one minute. */
export const TDG_MATCHED_ALIVE_SECONDS = 60;

const MATCHED_STATUSES = ['matched', 'matched_limited', 'matched_tft', 'matched_farmers'] as const;

/**
 * Quick Match players park here with no mode of their own. They are claimed by
 * whoever joins next, so this status never becomes a `matched_*` status itself —
 * it always resolves into one of the real modes first.
 */
export const QUICK_WAITING_STATUS = 'waiting_quick';

const WAITING_STATUSES = [
  'waiting',
  'waiting_limited',
  'waiting_tft',
  'waiting_farmers',
  QUICK_WAITING_STATUS,
] as const;

export async function ensureTdgPvpTables() {
  await initDatabase();
  // Match snapshots for ?game= rejoin (kept out of initDatabase so deploys stay additive).
  await sql`
    CREATE TABLE IF NOT EXISTS tdg_pvp_match_state (
      room_id VARCHAR(64) PRIMARY KEY,
      state JSONB NOT NULL,
      from_slot SMALLINT NOT NULL DEFAULT 0,
      mode VARCHAR(20) NOT NULL DEFAULT 'standard',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
}

export async function touchQueueSession(token: string) {
  await sql`
    UPDATE tdg_pvp_queue
    SET last_seen_at = CURRENT_TIMESTAMP
    WHERE session_token = ${token}
  `;
}

export async function cleanupStaleTdgQueue() {
  const staleRooms = (await sql`
    SELECT DISTINCT room_id
    FROM tdg_pvp_queue
    WHERE status IN ('matched', 'matched_limited', 'matched_tft', 'matched_farmers')
      AND room_id IS NOT NULL
      AND last_seen_at < NOW() - (${TDG_MATCHED_ALIVE_SECONDS} * INTERVAL '1 second')
  `) as unknown as Array<{ room_id: string }>;

  for (const stale of staleRooms) {
    const players = (await sql`
      SELECT session_token
      FROM tdg_pvp_queue
      WHERE room_id = ${stale.room_id}
    `) as unknown as Array<{ session_token: string }>;

    const cancelled = (await sql`
      UPDATE tdg_pvp_matches
      SET status = 'completed',
          winner_slot = NULL,
          end_reason = 'timeout',
          ended_at = CURRENT_TIMESTAMP
      WHERE room_id = ${stale.room_id}
        AND status = 'active'
      RETURNING room_id
    `) as unknown as Array<{ room_id: string }>;

    await deleteRoomById(stale.room_id);

    if (cancelled.length) {
      await Promise.all(
        players.map(async (player) => {
          try {
            await pusher.trigger(`tdg-player-${player.session_token}`, 'match_cancelled', {
              reason: 'player_timeout',
              t: Date.now(),
            });
          } catch (error) {
            console.warn('tdg-pvp timeout notify failed:', error);
          }
        }),
      );
    }
  }

  await sql`
    DELETE FROM tdg_pvp_queue
    WHERE status = ANY(${WAITING_STATUSES as unknown as string[]})
      AND last_seen_at < NOW() - INTERVAL '30 seconds'
  `;
  await sql`
    DELETE FROM tdg_pvp_queue
    WHERE status IN ('matched', 'matched_limited', 'matched_tft', 'matched_farmers')
      AND room_id IS NULL
      AND last_seen_at < NOW() - (${TDG_MATCHED_ALIVE_SECONDS} * INTERVAL '1 second')
  `;
  await sql`
    DELETE FROM tdg_pvp_match_state
    WHERE updated_at < NOW() - INTERVAL '10 minutes'
      AND room_id NOT IN (
        SELECT room_id FROM tdg_pvp_queue WHERE room_id IS NOT NULL
      )
  `;
}

export async function findQueueRowByToken(token: string) {
  const rows = (await sql`
    SELECT id, session_token, player_name, status, room_id, player_slot, opponent_name, opponent_token, last_seen_at
    FROM tdg_pvp_queue
    WHERE session_token = ${token}
    LIMIT 1
  `) as unknown as TdgQueueRow[];
  return rows[0] ?? null;
}

export async function findQueueRowByRoomAndToken(roomId: string, token: string) {
  const rows = (await sql`
    SELECT id, session_token, player_name, status, room_id, player_slot, opponent_name, opponent_token, last_seen_at
    FROM tdg_pvp_queue
    WHERE room_id = ${roomId}
      AND session_token = ${token}
      AND status IN ('matched', 'matched_limited', 'matched_tft', 'matched_farmers')
    LIMIT 1
  `) as unknown as TdgQueueRow[];
  return rows[0] ?? null;
}

export async function isQueueSessionAlive(row: TdgQueueRow) {
  if (!row.last_seen_at) return false;
  const waiting = (WAITING_STATUSES as readonly string[]).includes(row.status);
  const rows = waiting
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
          AND last_seen_at >= NOW() - (${TDG_MATCHED_ALIVE_SECONDS} * INTERVAL '1 second')
        LIMIT 1
      `) as unknown as Array<Record<string, never>>);
  return rows.length > 0;
}

export async function deleteRoomById(roomId: string) {
  await sql`
    DELETE FROM tdg_pvp_match_state
    WHERE room_id = ${roomId}
  `;
  await sql`
    DELETE FROM tdg_pvp_queue
    WHERE room_id = ${roomId}
  `;
}

/**
 * Remove one queue/match session.
 * 1v1 modes dissolve the whole room; TFT multi only drops that player so others can continue.
 */
export async function removeQueueSession(token: string) {
  const row = await findQueueRowByToken(token);
  if (!row) return null;

  const dissolveRoom =
    row.status === 'matched' ||
    row.status === 'matched_limited' ||
    row.status === 'matched_farmers' ||
    (row.status === 'matched_tft' && !row.room_id);

  if (dissolveRoom && row.room_id) {
    await deleteRoomById(row.room_id);
    return row;
  }

  await sql`
    DELETE FROM tdg_pvp_queue
    WHERE session_token = ${token}
  `;

  if (row.room_id) {
    const left = (await sql`
      SELECT COUNT(*)::int AS n
      FROM tdg_pvp_queue
      WHERE room_id = ${row.room_id}
    `) as unknown as Array<{ n: number }>;
    if (!left[0]?.n) {
      await sql`
        DELETE FROM tdg_pvp_match_state
        WHERE room_id = ${row.room_id}
      `;
    }
  }

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
      AND status IN ('matched', 'matched_limited', 'matched_tft', 'matched_farmers')
    LIMIT 1
  `) as unknown as Array<{ player_slot: number; player_name: string; status: string }>;
  return rows[0] ?? null;
}

function inferModeFromState(state: unknown, status?: string): string {
  if (status === 'matched_tft') return 'tft';
  if (status === 'matched_farmers') return 'farmers';
  if (status === 'matched_limited') return 'limited';
  if (state && typeof state === 'object') {
    const mode = (state as { mode?: string }).mode;
    if (mode === 'tft') return 'tft';
    if (mode === 'farmers') return 'farmers';
    if (mode === 'limited' || mode === 'limited_draft') return 'limited';
    if (mode === 'survival' || mode === 'standard') return 'standard';
  }
  return 'standard';
}

export async function upsertMatchState(roomId: string, state: unknown, fromSlot: number) {
  const mode = inferModeFromState(state);
  // postgres.js rejects raw objects in tagged templates — pass JSON text + cast.
  const payload = JSON.stringify(state ?? {});
  await sql.unsafe(
    `INSERT INTO tdg_pvp_match_state (room_id, state, from_slot, mode, updated_at)
     VALUES ($1, $2::jsonb, $3, $4, CURRENT_TIMESTAMP)
     ON CONFLICT (room_id) DO UPDATE SET
       state = EXCLUDED.state,
       from_slot = EXCLUDED.from_slot,
       mode = EXCLUDED.mode,
       updated_at = CURRENT_TIMESTAMP`,
    [roomId, payload, fromSlot, mode],
  );
}

export async function getMatchState(roomId: string) {
  const rows = (await sql`
    SELECT state, from_slot, mode, updated_at
    FROM tdg_pvp_match_state
    WHERE room_id = ${roomId}
    LIMIT 1
  `) as unknown as Array<{ state: unknown; from_slot: number; mode: string; updated_at: string | Date }>;
  return rows[0] ?? null;
}

export function matchedModeFlags(status: string) {
  return {
    limited: status === 'matched_limited',
    tft: status === 'matched_tft',
    farmers: status === 'matched_farmers',
  };
}

export { MATCHED_STATUSES };
