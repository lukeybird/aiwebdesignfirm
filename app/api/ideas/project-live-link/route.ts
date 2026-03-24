import { NextRequest, NextResponse } from 'next/server';
import { sql, initDatabase } from '@/lib/db';
import { parseLiveLinkInput } from '@/lib/ideaProjectHelpers';

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const slug = typeof body.slug === 'string' ? body.slug.trim() : '';
    if (!slug) {
      return NextResponse.json({ error: 'slug is required' }, { status: 400 });
    }

    let liveLink: string | null;
    try {
      liveLink = parseLiveLinkInput(body.liveLink);
    } catch (e: any) {
      return NextResponse.json({ error: e.message || 'Invalid link' }, { status: 400 });
    }

    const updated = await sql`
      UPDATE idea_projects
      SET live_link = ${liveLink}
      WHERE slug = ${slug}
      RETURNING slug, name, live_link
    `;

    if (updated.length === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const row = updated[0] as { slug: string; name: string; live_link: string | null };
    return NextResponse.json({
      project: {
        slug: row.slug,
        name: row.name,
        liveLink: row.live_link || '',
      },
    });
  } catch (e: any) {
    if (e?.message?.includes('live_link') && e?.message?.includes('does not exist')) {
      await initDatabase();
      return NextResponse.json({ error: 'Database was updated. Please try again.' }, { status: 503 });
    }
    return NextResponse.json({ error: e.message || 'Update failed' }, { status: 500 });
  }
}
