import { NextResponse } from 'next/server';
import { auth, isGoogleAuthConfigured } from '@/auth';
import { getUserById, updateUserProfile } from '@/lib/site-users';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({
        authenticated: false,
        googleConfigured: isGoogleAuthConfigured(),
        user: null,
      });
    }

    const row = await getUserById(session.user.id);
    if (!row) {
      return NextResponse.json({
        authenticated: false,
        googleConfigured: isGoogleAuthConfigured(),
        user: null,
      });
    }

    return NextResponse.json({
      authenticated: true,
      googleConfigured: isGoogleAuthConfigured(),
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
    console.error('account profile GET failed:', err);
    return NextResponse.json(
      {
        authenticated: false,
        googleConfigured: isGoogleAuthConfigured(),
        user: null,
        error: 'Auth misconfigured — check /api/account/health',
      },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request) {
  try {
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
