import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getUserById, updateUserProfile } from '@/lib/site-users';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function googleConfigured() {
  return !!(
    (process.env.AUTH_GOOGLE_ID || process.env.GOOGLE_CLIENT_ID) &&
    (process.env.AUTH_GOOGLE_SECRET || process.env.GOOGLE_CLIENT_SECRET) &&
    process.env.AUTH_SECRET
  );
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({
      authenticated: false,
      googleConfigured: googleConfigured(),
      user: null,
    });
  }

  const row = await getUserById(session.user.id);
  if (!row) {
    return NextResponse.json({
      authenticated: false,
      googleConfigured: googleConfigured(),
      user: null,
    });
  }

  return NextResponse.json({
    authenticated: true,
    googleConfigured: googleConfigured(),
    user: {
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      avatarUrl: row.avatar_url,
      bio: row.bio,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
    },
  });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }

  let body: { displayName?: string; bio?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  try {
    const row = await updateUserProfile(session.user.id, {
      displayName: body.displayName,
      bio: body.bio,
    });
    return NextResponse.json({
      ok: true,
      user: {
        id: row.id,
        email: row.email,
        displayName: row.display_name,
        avatarUrl: row.avatar_url,
        bio: row.bio,
        createdAt: new Date(row.created_at).toISOString(),
        updatedAt: new Date(row.updated_at).toISOString(),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Update failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
