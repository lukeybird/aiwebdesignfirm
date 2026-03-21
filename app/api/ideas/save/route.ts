import { NextRequest, NextResponse } from 'next/server';
import { sql, initDatabase } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { filename, content } = body;

    if (typeof filename !== 'string' || !filename.trim()) {
      return NextResponse.json(
        { error: 'filename is required' },
        { status: 400 }
      );
    }
    if (typeof content !== 'string') {
      return NextResponse.json(
        { error: 'content is required' },
        { status: 400 }
      );
    }
    if (!filename.toLowerCase().endsWith('.html')) {
      return NextResponse.json(
        { error: 'Only .html files can be saved' },
        { status: 400 }
      );
    }

    try {
      await sql`
        INSERT INTO idea_files (filename, content)
        VALUES (${filename.trim()}, ${content})
        ON CONFLICT (filename) DO UPDATE SET
          content = EXCLUDED.content,
          uploaded_at = CURRENT_TIMESTAMP
      `;
    } catch (dbError: any) {
      if (dbError?.message?.includes('idea_files') && dbError?.message?.includes('does not exist')) {
        await initDatabase();
        await sql`
          INSERT INTO idea_files (filename, content)
          VALUES (${filename.trim()}, ${content})
          ON CONFLICT (filename) DO UPDATE SET
            content = EXCLUDED.content,
            uploaded_at = CURRENT_TIMESTAMP
        `;
      } else {
        throw dbError;
      }
    }

    return NextResponse.json({ success: true, filename: filename.trim() });
  } catch (error: any) {
    console.error('[ideas/save]', error);
    return NextResponse.json(
      { error: error.message || 'Save failed' },
      { status: 500 }
    );
  }
}
