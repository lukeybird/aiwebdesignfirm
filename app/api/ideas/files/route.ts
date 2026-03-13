import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get('filename');

    if (filename) {
      const rows = await sql`
        SELECT filename, blob_url, file_size, uploaded_at
        FROM idea_files
        WHERE filename = ${filename}
        LIMIT 1
      `;
      if (rows.length === 0) {
        return NextResponse.json({ error: 'File not found' }, { status: 404 });
      }
      return NextResponse.json({ file: rows[0] });
    }

    const files = await sql`
      SELECT filename, blob_url, file_size, uploaded_at
      FROM idea_files
      ORDER BY uploaded_at DESC
    `;
    return NextResponse.json({ files });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
