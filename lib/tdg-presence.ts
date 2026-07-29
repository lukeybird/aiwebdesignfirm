import { initDatabase, sql } from '@/lib/db';

export const TDG_PRESENCE_ALIVE_SECONDS = 45;

export type TdgPresenceRow = {
  visitor_id: string;
  display_name: string | null;
  user_id: string | null;
  screen: string | null;
  last_seen_at: string | Date;
  first_seen_at: string | Date;
};

export type TdgPresencePublic = {
  visitorId: string;
  displayName: string;
  signedIn: boolean;
  screen: string;
  lastSeenAt: string;
  firstSeenAt: string;
};

let ensured = false;

export async function ensureTdgPresenceTable() {
  await initDatabase();
  if (ensured) return;
  await sql`
    CREATE TABLE IF NOT EXISTS tdg_presence (
      visitor_id VARCHAR(64) PRIMARY KEY,
      display_name VARCHAR(50),
      user_id UUID,
      screen VARCHAR(40) DEFAULT 'menu',
      last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      first_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_tdg_presence_alive
    ON tdg_presence (last_seen_at DESC)
  `;
  ensured = true;
}

export async function cleanupStaleTdgPresence() {
  await sql`
    DELETE FROM tdg_presence
    WHERE last_seen_at < NOW() - INTERVAL '2 minutes'
  `;
}

export async function upsertTdgPresence(params: {
  visitorId: string;
  displayName?: string | null;
  userId?: string | null;
  screen?: string | null;
}) {
  const visitorId = params.visitorId.trim().slice(0, 64);
  if (!visitorId) return null;

  const displayName = (params.displayName || '').trim().slice(0, 50) || null;
  const userId = params.userId || null;
  const screen = (params.screen || 'menu').trim().slice(0, 40) || 'menu';

  const rows = (await sql`
    INSERT INTO tdg_presence (visitor_id, display_name, user_id, screen, last_seen_at, first_seen_at)
    VALUES (${visitorId}, ${displayName}, ${userId}, ${screen}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT (visitor_id) DO UPDATE SET
      display_name = COALESCE(EXCLUDED.display_name, tdg_presence.display_name),
      user_id = COALESCE(EXCLUDED.user_id, tdg_presence.user_id),
      screen = EXCLUDED.screen,
      last_seen_at = CURRENT_TIMESTAMP
    RETURNING visitor_id, display_name, user_id, screen, last_seen_at, first_seen_at
  `) as unknown as TdgPresenceRow[];

  return rows[0] ?? null;
}

export async function removeTdgPresence(visitorId: string) {
  const id = visitorId.trim().slice(0, 64);
  if (!id) return;
  await sql`DELETE FROM tdg_presence WHERE visitor_id = ${id}`;
}

function guestLabel(visitorId: string) {
  return `Guest ${visitorId.slice(0, 4)}`;
}

export async function listLiveTdgPresence(): Promise<TdgPresencePublic[]> {
  await cleanupStaleTdgPresence();
  const rows = (await sql`
    SELECT visitor_id, display_name, user_id, screen, last_seen_at, first_seen_at
    FROM tdg_presence
    WHERE last_seen_at >= NOW() - INTERVAL '45 seconds'
    ORDER BY last_seen_at DESC
  `) as unknown as TdgPresenceRow[];

  return rows.map((row) => ({
    visitorId: row.visitor_id,
    displayName: row.display_name || guestLabel(row.visitor_id),
    signedIn: !!row.user_id,
    screen: row.screen || 'menu',
    lastSeenAt: new Date(row.last_seen_at).toISOString(),
    firstSeenAt: new Date(row.first_seen_at).toISOString(),
  }));
}
