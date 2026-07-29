import { createHmac, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export const DEV_AUTH_COOKIE = 'tdg_dev_auth';
const DEV_AUTH_MAX_AGE_SEC = 24 * 60 * 60; // 24h — matches localStorage session

function authSecret() {
  return process.env.AUTH_SECRET || process.env.TDG_JOIN_SECRET || 'dev-auth-fallback-change-me';
}

function expectedUsername() {
  return process.env.DEVELOPER_USERNAME || 'luke@webstarts.com';
}

function expectedPassword() {
  return process.env.DEVELOPER_PASSWORD || 'Dev74589900!';
}

export function verifyDeveloperCredentials(username: string, password: string) {
  return username === expectedUsername() && password === expectedPassword();
}

function signToken(payload: { sub: string; exp: number }) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', authSecret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verifyToken(token: string | undefined | null): boolean {
  if (!token || !token.includes('.')) return false;
  const [body, sig] = token.split('.');
  if (!body || !sig) return false;
  const expected = createHmac('sha256', authSecret()).update(body).digest('base64url');
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as {
      sub?: string;
      exp?: number;
    };
    if (payload.sub !== 'developer') return false;
    if (typeof payload.exp !== 'number' || Date.now() > payload.exp) return false;
    return true;
  } catch {
    return false;
  }
}

export function mintDeveloperSessionCookie() {
  const exp = Date.now() + DEV_AUTH_MAX_AGE_SEC * 1000;
  const token = signToken({ sub: 'developer', exp });
  return {
    name: DEV_AUTH_COOKIE,
    value: token,
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
      maxAge: DEV_AUTH_MAX_AGE_SEC,
    },
  };
}

export function clearDeveloperSessionCookie() {
  return {
    name: DEV_AUTH_COOKIE,
    value: '',
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
      maxAge: 0,
    },
  };
}

/** Server Components / Route Handlers via next/headers cookies(). */
export async function isDeveloperAuthenticatedFromCookies() {
  const jar = await cookies();
  return verifyToken(jar.get(DEV_AUTH_COOKIE)?.value);
}

/** API routes with a NextRequest. */
export function isDeveloperAuthenticatedRequest(request: NextRequest) {
  const token = request.cookies.get(DEV_AUTH_COOKIE)?.value;
  return verifyToken(token);
}

export function unauthorizedDeveloperJson() {
  return NextResponse.json(
    { error: 'Developer login required.', loginUrl: '/login/developer' },
    { status: 401 },
  );
}
