import { NextRequest, NextResponse } from 'next/server';
import { isValidDeveloperCredentials } from '@/lib/developer-credentials';
import {
  DEV_PORTAL_COOKIE,
  DEV_PORTAL_COOKIE_MAX_AGE_SEC,
  signDevPortalCookieValue,
} from '@/lib/dev-portal-cookie';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as {
      username?: string;
      password?: string;
    } | null;
    const username = typeof body?.username === 'string' ? body.username : '';
    const password = typeof body?.password === 'string' ? body.password : '';

    if (!isValidDeveloperCredentials(username, password)) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    let token: string;
    try {
      token = signDevPortalCookieValue();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Server misconfiguration';
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    const res = NextResponse.json({ ok: true });
    res.cookies.set(DEV_PORTAL_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: DEV_PORTAL_COOKIE_MAX_AGE_SEC,
    });
    return res;
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
}
