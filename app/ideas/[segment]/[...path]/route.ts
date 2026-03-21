import { NextRequest, NextResponse } from 'next/server';
import { sql, initDatabase } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ segment: string; path: string[] }> }
) {
  const { segment, path } = await params;
  if (!path || path.length === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const filePath = path.map((p) => decodeURIComponent(p)).join('/');

  try {
    const projects = await sql`
      SELECT id FROM idea_projects WHERE slug = ${segment} LIMIT 1
    `;
    if (projects.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const projectId = (projects[0] as { id: number }).id;

    const rows = await sql`
      SELECT content, mime_type, is_binary
      FROM idea_project_files
      WHERE project_id = ${projectId} AND file_path = ${filePath}
      LIMIT 1
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const row = rows[0] as { content: string; mime_type: string | null; is_binary: boolean };
    const mime = row.mime_type || 'application/octet-stream';

    if (row.is_binary) {
      const buf = Buffer.from(row.content, 'base64');
      return new NextResponse(buf, {
        status: 200,
        headers: {
          'Content-Type': mime,
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }

    return new NextResponse(row.content, {
      status: 200,
      headers: {
        'Content-Type': mime.includes('charset') ? mime : `${mime}; charset=utf-8`,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (e: any) {
    if (e?.message?.includes('idea_projects') && e?.message?.includes('does not exist')) {
      await initDatabase();
      return NextResponse.json({ error: 'Try again' }, { status: 503 });
    }
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
