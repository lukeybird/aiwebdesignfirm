import { NextRequest, NextResponse } from 'next/server';
import AdmZip from 'adm-zip';
import {
  sanitizeSlug,
  normalizePath,
  shouldSkipZipPath,
  extMime,
  isProbablyText,
  MAX_FILE_BYTES,
  MAX_ZIP_FILES,
  MAX_ZIP_TOTAL_BYTES,
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
    const zipFile = formData.get('zip') as File | null;

    if (!zipFile || zipFile.size === 0) {
      return NextResponse.json({ error: 'No ZIP file provided' }, { status: 400 });
    }

    if (zipFile.size > 80 * 1024 * 1024) {
      return NextResponse.json({ error: 'ZIP file too large (max 80 MB)' }, { status: 400 });
    }

    const buffer = Buffer.from(await zipFile.arrayBuffer());
    let zip: AdmZip;
    try {
      zip = new AdmZip(buffer);
    } catch {
      return NextResponse.json({ error: 'Invalid or corrupted ZIP file' }, { status: 400 });
    }

    const entries: IdeaFileEntry[] = [];
    let totalBytes = 0;
    const zipEntries = zip.getEntries();

    for (const entry of zipEntries) {
      if (entries.length >= MAX_ZIP_FILES) {
        return NextResponse.json(
          { error: `Too many files in ZIP (max ${MAX_ZIP_FILES}). Exclude node_modules — it is skipped automatically.` },
          { status: 400 }
        );
      }

      if (entry.isDirectory) continue;

      const rawName = entry.entryName;
      if (shouldSkipZipPath(rawName)) continue;

      const rel = normalizePath(rawName);
      if (!rel) continue;

      const data = entry.getData();
      if (data.length > MAX_FILE_BYTES) {
        return NextResponse.json(
          { error: `File in ZIP too large (max 5 MB each): ${rel}` },
          { status: 400 }
        );
      }
      totalBytes += data.length;
      if (totalBytes > MAX_ZIP_TOTAL_BYTES) {
        return NextResponse.json(
          { error: `Unzipped total too large (max ~${Math.round(MAX_ZIP_TOTAL_BYTES / 1024 / 1024)} MB). Remove node_modules before zipping.` },
          { status: 400 }
        );
      }

      const mime = extMime(rel);
      const binary = !isProbablyText(rel, mime);
      const content = binary ? data.toString('base64') : sanitizePostgresUtf8(data.toString('utf8'));
      entries.push({ path: rel, content, mime, binary });
    }

    if (entries.length === 0) {
      return NextResponse.json(
        { error: 'ZIP had no usable files. Add source files (HTML, CSS, JS, etc.). node_modules and .git are ignored.' },
        { status: 400 }
      );
    }

    try {
      const project = await insertIdeaProject(slug, displayName, entries);
      return NextResponse.json({
        success: true,
        project: { ...project, skippedNote: 'node_modules, .git, .next, __pycache__ were skipped if present.' },
      });
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
    return NextResponse.json({ error: error.message || 'ZIP upload failed' }, { status: 500 });
  }
}
