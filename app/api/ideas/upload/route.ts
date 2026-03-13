import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { put } from '@vercel/blob';

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

    const blob = await put(`ideas/${file.name}`, file, {
      access: 'public',
    });

    await sql`
      INSERT INTO idea_files (filename, blob_url, file_size)
      VALUES (${file.name}, ${blob.url}, ${file.size})
      ON CONFLICT (filename) DO UPDATE SET
        blob_url = EXCLUDED.blob_url,
        file_size = EXCLUDED.file_size,
        uploaded_at = CURRENT_TIMESTAMP
    `;

    return NextResponse.json({
      success: true,
      filename: file.name,
      url: blob.url,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
