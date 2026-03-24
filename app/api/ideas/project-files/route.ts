import { NextRequest, NextResponse } from 'next/server';
import { sql, initDatabase } from '@/lib/db';
import { parseLiveLinkInput } from '@/lib/ideaProjectHelpers';

export async function GET(request: NextRequest) {
  try {
    const slug = request.nextUrl.searchParams.get('slug');
    if (!slug) {
      return NextResponse.json({ error: 'slug required' }, { status: 400 });
    }

    let projects;
    try {
      projects = await sql`
        SELECT id, slug, name, live_link FROM idea_projects WHERE slug = ${slug} LIMIT 1
      `;
    } catch (e: any) {
      if (e?.message?.includes('live_link') && e?.message?.includes('does not exist')) {
        await initDatabase();
        projects = await sql`
          SELECT id, slug, name, live_link FROM idea_projects WHERE slug = ${slug} LIMIT 1
        `;
      } else throw e;
    }
    if (projects.length === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const project = projects[0] as { id: number; slug: string; name: string; live_link: string | null };
    const files = await sql`
      SELECT file_path FROM idea_project_files WHERE project_id = ${project.id} ORDER BY file_path
    `;

    const paths = (files as unknown as { file_path: string }[]).map((f) => f.file_path);
    let liveLink = '';
    if (project.live_link) {
      try {
        liveLink = parseLiveLinkInput(project.live_link) || '';
      } catch {
        liveLink = '';
      }
    }

    return NextResponse.json({ project: { slug: project.slug, name: project.name, liveLink }, files: paths });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
