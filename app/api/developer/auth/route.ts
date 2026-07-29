import { NextRequest, NextResponse } from 'next/server';
import {
  clearDeveloperSessionCookie,
  mintDeveloperSessionCookie,
  verifyDeveloperCredentials,
} from '@/lib/developer-auth';

/** POST — Developer login; sets httpOnly session cookie for protected APIs. */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      username?: string;
      password?: string;
    };
    const username = typeof body.username === 'string' ? body.username.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!verifyDeveloperCredentials(username, password)) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
    }

    const cookie = mintDeveloperSessionCookie();
    const res = NextResponse.json({
      success: true,
      message: 'Authentication successful',
    });
    res.cookies.set(cookie.name, cookie.value, cookie.options);
    return res;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Login failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** DELETE — clear developer session cookie. */
export async function DELETE() {
  const cookie = clearDeveloperSessionCookie();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(cookie.name, cookie.value, cookie.options);
  return res;
}
