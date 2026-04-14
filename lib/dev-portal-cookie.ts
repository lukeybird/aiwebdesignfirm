import { createHmac, timingSafeEqual } from 'node:crypto';

export const DEV_PORTAL_COOKIE = 'dev_portal';
export const DEV_PORTAL_COOKIE_MAX_AGE_SEC = 24 * 60 * 60;

function secret(): string {
  const s = process.env.DEV_SESSION_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === 'development') {
    return 'dev-local-dev-portal-secret-min-16';
  }
  return '';
}

export function signDevPortalCookieValue(): string {
  const key = secret();
  if (!key) {
    throw new Error('Set DEV_SESSION_SECRET (min 16 chars) in production for developer / booking admin access.');
  }
  const exp = Math.floor(Date.now() / 1000) + DEV_PORTAL_COOKIE_MAX_AGE_SEC;
  const payload = Buffer.from(JSON.stringify({ exp }), 'utf8').toString('base64url');
  const sig = createHmac('sha256', key).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyDevPortalCookieValue(value: string | undefined): boolean {
  if (!value) return false;
  const key = secret();
  if (!key) return false;
  const last = value.lastIndexOf('.');
  if (last <= 0) return false;
  const payload = value.slice(0, last);
  const sig = value.slice(last + 1);
  const expected = createHmac('sha256', key).update(payload).digest('base64url');
  if (sig.length !== expected.length) return false;
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  } catch {
    return false;
  }
  try {
    const json = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { exp?: number };
    if (typeof json.exp !== 'number' || json.exp < Math.floor(Date.now() / 1000)) return false;
    return true;
  } catch {
    return false;
  }
}
