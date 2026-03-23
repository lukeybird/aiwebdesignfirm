import { NextRequest, NextResponse } from 'next/server';
import { del } from '@vercel/blob';
import { insertIdeaProject, sanitizeSlug } from '@/lib/ideaProjectHelpers';
import { extractIdeaProjectEntriesFromZip } from '@/lib/processIdeaProjectZip';

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  let blobUrl: string | undefined;
  try {
    const body = await request.json();
    blobUrl = body.blobUrl;
    const slugRaw = (body.slug as string) || '';
    const displayName = ((body.displayName as string) || '').trim() || 'Untitled project';
    const slug = sanitizeSlug(slugRaw || displayName);

    if (!blobUrl || typeof blobUrl !== 'string') {
      return NextResponse.json({ error: 'blobUrl is required' }, { status: 400 });
    }

    const res = await fetch(blobUrl);
    if (!res.ok) {
      return NextResponse.json({ error: 'Could not download uploaded ZIP from storage' }, { status: 400 });
    }

    const buffer = Buffer.from(await res.arrayBuffer());

    let entries;
    try {
      entries = extractIdeaProjectEntriesFromZip(buffer);
    } catch (e: any) {
      await del(blobUrl).catch(() => {});
      return NextResponse.json({ error: e.message || 'Invalid ZIP' }, { status: 400 });
    }

    try {
      const project = await insertIdeaProject(slug, displayName, entries);
      await del(blobUrl).catch(() => {});
      return NextResponse.json({
        success: true,
        project: { ...project, skippedNote: 'node_modules, .git, .next, __pycache__ were skipped if present.' },
      });
    } catch (e: any) {
      await del(blobUrl).catch(() => {});
      const msg = e?.message || 'Upload failed';
      if (msg.includes('already exists') || msg.includes('Slug')) {
        return NextResponse.json({ error: msg }, { status: 409 });
      }
      if (msg.includes('initialized')) {
        return NextResponse.json({ error: msg }, { status: 503 });
      }
      throw e;
    }
  } catch (error: any) {
    if (blobUrl) await del(blobUrl).catch(() => {});
    return NextResponse.json({ error: error.message || 'Processing failed' }, { status: 500 });
  }
}
