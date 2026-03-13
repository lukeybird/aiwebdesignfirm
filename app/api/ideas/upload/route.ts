import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    const name = file.name.toLowerCase();
    if (!name.endsWith('.html')) {
      return NextResponse.json(
        { error: 'Only .html files are allowed' },
        { status: 400 }
      );
    }

    const content = await file.text();

    await sql`
      INSERT INTO idea_files (filename, content)
      VALUES (${file.name}, ${content})
      ON CONFLICT (filename) DO UPDATE SET
        content = EXCLUDED.content,
        uploaded_at = CURRENT_TIMESTAMP
    `;

    return NextResponse.json({
      success: true,
      filename: file.name,
    });
  } catch (error: any) {
    console.error('[ideas/upload]', error);
    return NextResponse.json(
      { error: error.message || 'Upload failed' },
      { status: 500 }
    );
  }
}
