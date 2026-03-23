import { NextResponse } from 'next/server';
import { generateClientTokenFromReadWriteToken } from '@vercel/blob/client';
import { MAX_ZIP_UPLOAD_BYTES } from '@/lib/ideaProjectHelpers';

export const maxDuration = 60;

/**
 * Returns a short-lived client token so the browser can upload a large ZIP
 * directly to Vercel Blob (bypasses the ~4.5MB serverless request body limit).
 */
export async function POST() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      {
        error: 'BLOB_READ_WRITE_TOKEN is not set. Add Vercel Blob to the project or use a smaller ZIP for direct upload.',
      },
      { status: 503 }
    );
  }

  const pathname = `ideas/project-zips/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.zip`;

  try {
    const clientToken = await generateClientTokenFromReadWriteToken({
      pathname,
      maximumSizeInBytes: MAX_ZIP_UPLOAD_BYTES,
      allowedContentTypes: [
        'application/zip',
        'application/x-zip-compressed',
        'application/octet-stream',
        'binary/octet-stream',
      ],
      addRandomSuffix: true,
    });

    return NextResponse.json({ clientToken, pathname });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Could not create upload token' }, { status: 500 });
  }
}
