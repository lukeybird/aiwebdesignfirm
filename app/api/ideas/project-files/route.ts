import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const slug = request.nextUrl.searchParams.get('slug');
    if (!slug) {
      return NextResponse.json({ error: 'slug required' }, { status: 400 });
    }

    const projects = await sql`
      SELECT id, slug, name FROM idea_projects WHERE slug = ${slug} LIMIT 1
    `;
    if (projects.length === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const project = projects[0] as { id: number; slug: string; name: string };
    const files = await sql`
      SELECT file_path FROM idea_project_files WHERE project_id = ${project.id} ORDER BY file_path
    `;

    const paths = (files as unknown as { file_path: string }[]).map((f) => f.file_path);
    return NextResponse.json({
      project: { slug: project.slug, name: project.name },
      files: paths,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
