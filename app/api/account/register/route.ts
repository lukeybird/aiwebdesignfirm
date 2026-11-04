import { NextResponse } from 'next/server';
import { allowAuthAttempt, createPasswordAccount, normalizeEmail } from '@/lib/password-accounts';

export async function POST(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) return NextResponse.json({ error: 'Invalid request.' }, { status: 403 });
  try {
    if (Number(request.headers.get('content-length')) > 4096) return NextResponse.json({ error: 'Request too large.' }, { status: 413 });
    const input = await request.json();
    const email = normalizeEmail(input.email);
    const password = typeof input.password === 'string' ? input.password : '';
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !name || name.length > 100 || password.length < 12 || Buffer.byteLength(password) > 72) {
      return NextResponse.json({ error: 'Enter your name, a valid email, and a password of at least 12 characters (up to 72 bytes).' }, { status: 400 });
    }
    const ip = request.headers.get('x-vercel-forwarded-for') || request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
    if (!(await allowAuthAttempt('register-ip:' + ip, 10)) || !(await allowAuthAttempt('register-email:' + email, 5))) return NextResponse.json({ error: 'Too many attempts. Please try again in 15 minutes.' }, { status: 429 });
    await createPasswordAccount(email, password, name);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error && error.message.startsWith('An account') ? error.message : 'Unable to create your account. Please try signing in or try again later.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
