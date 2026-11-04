import { createHash, randomUUID } from 'node:crypto';
import { compare, hash } from 'bcryptjs';
import { sql } from '@/lib/db';
import { ensureSiteUserTables, getUserById } from '@/lib/site-users';

async function ensurePasswordTables() {
  await ensureSiteUserTables();
  await sql`CREATE TABLE IF NOT EXISTS site_password_accounts (
    email TEXT PRIMARY KEY, user_id UUID NOT NULL UNIQUE REFERENCES site_users(id) ON DELETE CASCADE,
    password_hash TEXT NOT NULL
  )`;
  await sql`CREATE TABLE IF NOT EXISTS site_auth_limits (
    key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, reset_at TIMESTAMPTZ NOT NULL
  )`;
}

export async function allowAuthAttempt(identity: string, limit: number) {
  await ensurePasswordTables();
  const key = createHash('sha256').update(identity).digest('hex');
  const rows = await sql`INSERT INTO site_auth_limits (key, attempts, reset_at)
    VALUES (${key}, 1, NOW() + INTERVAL '15 minutes')
    ON CONFLICT (key) DO UPDATE SET
      attempts = CASE WHEN site_auth_limits.reset_at < NOW() THEN 1 ELSE site_auth_limits.attempts + 1 END,
      reset_at = CASE WHEN site_auth_limits.reset_at < NOW() THEN NOW() + INTERVAL '15 minutes' ELSE site_auth_limits.reset_at END
    RETURNING attempts`;
  return rows[0].attempts <= limit;
}

export function normalizeEmail(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export async function createPasswordAccount(email: string, password: string, name: string) {
  await ensurePasswordTables();
  const existing = await sql`SELECT id FROM site_users WHERE LOWER(email) = ${email} LIMIT 1`;
  if (existing.length) throw new Error('An account with this email already exists. Please sign in using your original method.');
  const passwordHash = await hash(password, 12);
  const id = randomUUID();
  const displayName = (name.replace(/[^\w\s\-'.]/g, '').trim().slice(0, 28) || 'Member') + ' ' + id.slice(0, 8);
  await sql`WITH new_user AS (
    INSERT INTO site_users (id, google_sub, email, display_name)
    VALUES (${id}, ${'email:' + id}, ${email}, ${displayName}) RETURNING id
  ) INSERT INTO site_password_accounts (email, user_id, password_hash)
    SELECT ${email}, id, ${passwordHash} FROM new_user`;
}

export async function authenticatePassword(email: string, password: string) {
  if (!email || !password || Buffer.byteLength(password) > 72) return null;
  if (!(await allowAuthAttempt('login:' + email, 15))) return null;
  const rows = await sql`SELECT user_id, password_hash FROM site_password_accounts WHERE email = ${email}`;
  // A fixed valid bcrypt hash keeps unknown-account checks comparable in cost.
  const valid = await compare(password, rows[0]?.password_hash || '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6Ttx8fRjM6vH3k1sR.CuWrzgT9n1W');
  return valid && rows[0] ? getUserById(rows[0].user_id) : null;
}
