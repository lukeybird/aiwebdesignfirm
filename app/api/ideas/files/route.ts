import { NextRequest, NextResponse } from 'next/server';
import { sql, initDatabase } from '@/lib/db';

async function ensureTable() {
  try {
    await sql`SELECT 1 FROM idea_files LIMIT 1`;
  } catch (e: any) {
    if (e?.message?.includes('idea_files') && e?.message?.includes('does not exist')) {
      await initDatabase();
    } else {
      throw e;
    }
  }
}

export async function GET(request: NextRequest) {
  try {
    await ensureTable();

    const { searchParams } = new URL(request.url);
    const filename = searchParams.get('filename');

    if (filename) {
      const rows = await sql`
        SELECT filename, content, blob_url, uploaded_at
        FROM idea_files
        WHERE filename = ${filename}
        LIMIT 1
      `;
      if (rows.length === 0) {
        return NextResponse.json({ error: 'File not found' }, { status: 404 });
      }
      const row = rows[0] as { filename: string; content: string | null; blob_url?: string | null; uploaded_at: string };
      return NextResponse.json({
        file: {
          filename: row.filename,
          content: row.content ?? null,
          blob_url: row.blob_url ?? null,
          uploaded_at: row.uploaded_at,
        },
      });
    }

    const files = await sql`
      SELECT filename, uploaded_at
      FROM idea_files
      ORDER BY uploaded_at DESC
    `;
    return NextResponse.json({ files });
  } catch (error: any) {
    console.error('[ideas/files]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to list files' },
      { status: 500 }
    );
  }
}
