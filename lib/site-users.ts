import { sql, initDatabase } from '@/lib/db';

export type SiteUser = {
  id: string;
  google_sub: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  created_at: string | Date;
  updated_at: string | Date;
};

let ensured = false;

export async function ensureSiteUserTables() {
  if (ensured) return;
  await initDatabase();
  await sql`
    CREATE TABLE IF NOT EXISTS site_users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      google_sub VARCHAR(128) NOT NULL UNIQUE,
      email VARCHAR(255) NOT NULL,
      display_name VARCHAR(40) NOT NULL,
      avatar_url TEXT,
      bio VARCHAR(280),
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_site_users_display_name_lower
    ON site_users (LOWER(display_name))
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS tdg_leaderboard (
      user_id UUID NOT NULL REFERENCES site_users(id) ON DELETE CASCADE,
      mode VARCHAR(20) NOT NULL DEFAULT 'standard',
      wins INT NOT NULL DEFAULT 0,
      losses INT NOT NULL DEFAULT 0,
      draws INT NOT NULL DEFAULT 0,
      last_played_at TIMESTAMP,
      PRIMARY KEY (user_id, mode)
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_tdg_leaderboard_wins
    ON tdg_leaderboard (mode, wins DESC, losses ASC)
  `;
  // Best-effort: store mode on completed matches when column exists later.
  try {
    await sql`ALTER TABLE tdg_pvp_matches ADD COLUMN IF NOT EXISTS mode VARCHAR(20) DEFAULT 'standard'`;
  } catch {
    // older postgres without IF NOT EXISTS on ADD COLUMN — ignore
  }
  ensured = true;
}

function sanitizeDisplayName(raw: string | null | undefined, fallbackEmail?: string) {
  const base = (raw || fallbackEmail?.split('@')[0] || 'Player')
    .replace(/[^\w\s\-'.]/g, '')
    .trim()
    .slice(0, 40);
  return base.length >= 2 ? base : 'Player';
}

async function uniqueDisplayName(desired: string, excludeId?: string) {
  let candidate = sanitizeDisplayName(desired);
  for (let i = 0; i < 12; i++) {
    const rows = (await sql`
      SELECT id FROM site_users
      WHERE LOWER(display_name) = LOWER(${candidate})
        AND (${excludeId || null}::uuid IS NULL OR id <> ${excludeId || null}::uuid)
      LIMIT 1
    `) as unknown as Array<{ id: string }>;
    if (!rows[0]) return candidate;
    const suffix = String(Math.floor(10 + Math.random() * 89));
    candidate = sanitizeDisplayName(`${desired.slice(0, 36)}${suffix}`);
  }
  return sanitizeDisplayName(`${desired.slice(0, 30)}${Date.now().toString().slice(-4)}`);
}

export async function upsertGoogleUser(input: {
  googleSub: string;
  email: string;
  name?: string | null;
  image?: string | null;
}): Promise<SiteUser> {
  await ensureSiteUserTables();
  const existing = await getUserByGoogleSub(input.googleSub);
  if (existing) {
    const rows = (await sql`
      UPDATE site_users
      SET email = ${input.email || existing.email},
          avatar_url = COALESCE(avatar_url, ${input.image || null}),
          updated_at = CURRENT_TIMESTAMP
      WHERE google_sub = ${input.googleSub}
      RETURNING *
    `) as unknown as SiteUser[];
    return rows[0] || existing;
  }

  const displayName = await uniqueDisplayName(input.name || input.email);
  const rows = (await sql`
    INSERT INTO site_users (google_sub, email, display_name, avatar_url)
    VALUES (
      ${input.googleSub},
      ${input.email},
      ${displayName},
      ${input.image || null}
    )
    RETURNING *
  `) as unknown as SiteUser[];
  return rows[0];
}

export async function getUserByGoogleSub(googleSub: string): Promise<SiteUser | null> {
  await ensureSiteUserTables();
  const rows = (await sql`
    SELECT * FROM site_users WHERE google_sub = ${googleSub} LIMIT 1
  `) as unknown as SiteUser[];
  return rows[0] || null;
}

export async function getUserById(id: string): Promise<SiteUser | null> {
  await ensureSiteUserTables();
  const rows = (await sql`
    SELECT * FROM site_users WHERE id = ${id}::uuid LIMIT 1
  `) as unknown as SiteUser[];
  return rows[0] || null;
}

export async function listSiteUsers(): Promise<SiteUser[]> {
  await ensureSiteUserTables();
  return (await sql`
    SELECT *
    FROM site_users
    ORDER BY created_at DESC, display_name ASC
  `) as unknown as SiteUser[];
}

export async function getUserByDisplayName(name: string): Promise<SiteUser | null> {
  await ensureSiteUserTables();
  const rows = (await sql`
    SELECT * FROM site_users WHERE LOWER(display_name) = LOWER(${name.trim()}) LIMIT 1
  `) as unknown as SiteUser[];
  return rows[0] || null;
}

export async function updateUserProfile(
  userId: string,
  patch: { displayName?: string; bio?: string | null; avatarUrl?: string | null },
): Promise<SiteUser> {
  await ensureSiteUserTables();
  const current = await getUserById(userId);
  if (!current) throw new Error('User not found');

  let displayName = current.display_name;
  if (patch.displayName != null) {
    const cleaned = sanitizeDisplayName(patch.displayName);
    if (cleaned.length < 2) throw new Error('Display name must be at least 2 characters');
    displayName = await uniqueDisplayName(cleaned, userId);
  }

  let bio = current.bio;
  if (patch.bio !== undefined) {
    bio = patch.bio == null || patch.bio === '' ? null : String(patch.bio).trim().slice(0, 280);
  }

  let avatarUrl = current.avatar_url;
  if (patch.avatarUrl !== undefined) {
    const candidate = patch.avatarUrl == null ? '' : String(patch.avatarUrl).trim();
    if (candidate && !/^\/TDG\/portraits\/[a-z0-9_-]+\.webp$/i.test(candidate)) {
      throw new Error('Choose a valid Territory Game character portrait');
    }
    avatarUrl = candidate || null;
  }

  const rows = (await sql`
    UPDATE site_users
    SET display_name = ${displayName},
        bio = ${bio},
        avatar_url = ${avatarUrl},
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${userId}::uuid
    RETURNING *
  `) as unknown as SiteUser[];
  return rows[0];
}

export type LeaderboardMode = 'standard' | 'limited' | 'tft' | 'all';

export async function bumpLeaderboardForName(
  playerName: string,
  mode: string,
  outcome: 'win' | 'loss' | 'draw',
) {
  await ensureSiteUserTables();
  const user = await getUserByDisplayName(playerName);
  if (!user) return;
  const safeMode = mode === 'tft' || mode === 'limited' ? mode : 'standard';
  await sql`
    INSERT INTO tdg_leaderboard (user_id, mode, wins, losses, draws, last_played_at)
    VALUES (
      ${user.id}::uuid,
      ${safeMode},
      ${outcome === 'win' ? 1 : 0},
      ${outcome === 'loss' ? 1 : 0},
      ${outcome === 'draw' ? 1 : 0},
      CURRENT_TIMESTAMP
    )
    ON CONFLICT (user_id, mode) DO UPDATE SET
      wins = tdg_leaderboard.wins + ${outcome === 'win' ? 1 : 0},
      losses = tdg_leaderboard.losses + ${outcome === 'loss' ? 1 : 0},
      draws = tdg_leaderboard.draws + ${outcome === 'draw' ? 1 : 0},
      last_played_at = CURRENT_TIMESTAMP
  `;
}

export async function getLeaderboard(mode: LeaderboardMode = 'all', limit = 50) {
  await ensureSiteUserTables();
  const lim = Math.max(1, Math.min(100, limit));

  if (mode === 'all') {
    const rows = (await sql`
      SELECT
        u.id AS user_id,
        u.display_name,
        u.avatar_url,
        COALESCE(SUM(l.wins), 0)::int AS wins,
        COALESCE(SUM(l.losses), 0)::int AS losses,
        COALESCE(SUM(l.draws), 0)::int AS draws,
        MAX(l.last_played_at) AS last_played_at
      FROM site_users u
      LEFT JOIN tdg_leaderboard l ON l.user_id = u.id
      GROUP BY u.id, u.display_name, u.avatar_url
      HAVING COALESCE(SUM(l.wins + l.losses + l.draws), 0) > 0
      ORDER BY wins DESC, losses ASC, u.display_name ASC
      LIMIT ${lim}
    `) as unknown as Array<{
      user_id: string;
      display_name: string;
      avatar_url: string | null;
      wins: number;
      losses: number;
      draws: number;
      last_played_at: string | Date | null;
    }>;
    return rows;
  }

  const rows = (await sql`
    SELECT
      u.id AS user_id,
      u.display_name,
      u.avatar_url,
      l.wins,
      l.losses,
      l.draws,
      l.last_played_at
    FROM tdg_leaderboard l
    JOIN site_users u ON u.id = l.user_id
    WHERE l.mode = ${mode}
    ORDER BY l.wins DESC, l.losses ASC, u.display_name ASC
    LIMIT ${lim}
  `) as unknown as Array<{
    user_id: string;
    display_name: string;
    avatar_url: string | null;
    wins: number;
    losses: number;
    draws: number;
    last_played_at: string | Date | null;
  }>;
  return rows;
}
