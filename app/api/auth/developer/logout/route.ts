import { NextResponse } from 'next/server';
import { DEV_PORTAL_COOKIE } from '@/lib/dev-portal-cookie';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(DEV_PORTAL_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return res;
}
