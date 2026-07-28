import { NextResponse } from 'next/server';
import { isGoogleAuthConfigured } from '@/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Safe diagnostics — never returns secret values. */
export async function GET() {
  const has = (key: string) => Boolean(process.env[key] && String(process.env[key]).trim());
  return NextResponse.json({
    ok: true,
    googleAuthConfigured: isGoogleAuthConfigured(),
    env: {
      AUTH_SECRET: has('AUTH_SECRET') || has('NEXTAUTH_SECRET'),
      AUTH_URL: has('AUTH_URL') || has('NEXTAUTH_URL'),
      AUTH_GOOGLE_ID: has('AUTH_GOOGLE_ID') || has('GOOGLE_CLIENT_ID'),
      AUTH_GOOGLE_SECRET: has('AUTH_GOOGLE_SECRET') || has('GOOGLE_CLIENT_SECRET'),
      POSTGRES_URL: has('POSTGRES_URL') || has('DATABASE_URL'),
    },
    authUrlHint: process.env.AUTH_URL || process.env.NEXTAUTH_URL || null,
  });
}
