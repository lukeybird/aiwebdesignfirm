import { NextRequest, NextResponse } from 'next/server';
import {
  sanitizeSlug,
  normalizePath,
  extMime,
  isProbablyText,
  MAX_FILE_BYTES,
  sanitizePostgresUtf8,
  insertIdeaProject,
  type IdeaFileEntry,
} from '@/lib/ideaProjectHelpers';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const slugRaw = (formData.get('slug') as string) || '';
    const displayName = ((formData.get('displayName') as string) || '').trim() || 'Untitled project';
    const slug = sanitizeSlug(slugRaw || displayName);

    const files = formData.getAll('file') as File[];
    const paths = formData.getAll('path') as string[];

    if (!files.length || files.length !== paths.length) {
      return NextResponse.json(
        { error: 'Missing files or path count mismatch. Each file needs a matching path.' },
        { status: 400 }
      );
    }

    const entries: IdeaFileEntry[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const rel = normalizePath(paths[i] || file.name);
      if (!rel) {
        return NextResponse.json({ error: `Invalid path: ${paths[i]}` }, { status: 400 });
      }
      if (file.size > MAX_FILE_BYTES) {
        return NextResponse.json({ error: `File too large (max 5 MB): ${rel}` }, { status: 400 });
      }
      const mime = extMime(rel);
      const binary = !isProbablyText(rel, mime);
      let content: string;
      if (binary) {
        const buf = Buffer.from(await file.arrayBuffer());
        content = buf.toString('base64');
      } else {
        content = sanitizePostgresUtf8(await file.text());
      }
      entries.push({ path: rel, content, mime, binary });
    }

    try {
      const project = await insertIdeaProject(slug, displayName, entries);
      return NextResponse.json({ success: true, project });
    } catch (e: any) {
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
    return NextResponse.json({ error: error.message || 'Upload failed' }, { status: 500 });
  }
}
