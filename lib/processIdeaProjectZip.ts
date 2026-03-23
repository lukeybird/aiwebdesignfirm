import AdmZip from 'adm-zip';
import {
  normalizePath,
  shouldSkipZipPath,
  extMime,
  isProbablyText,
  MAX_FILE_BYTES,
  MAX_ZIP_FILES,
  MAX_ZIP_TOTAL_BYTES,
  sanitizePostgresUtf8,
  type IdeaFileEntry,
} from '@/lib/ideaProjectHelpers';

/**
 * Extract project file entries from a ZIP buffer. Throws Error with a user-facing message on failure.
 */
export function extractIdeaProjectEntriesFromZip(buffer: Buffer): IdeaFileEntry[] {
  let zip: AdmZip;
  try {
    zip = new AdmZip(buffer);
  } catch {
    throw new Error('Invalid or corrupted ZIP file');
  }

  const entries: IdeaFileEntry[] = [];
  let totalBytes = 0;
  const zipEntries = zip.getEntries();

  for (const entry of zipEntries) {
    if (entries.length >= MAX_ZIP_FILES) {
      throw new Error(
        `Too many files in ZIP (max ${MAX_ZIP_FILES}). Exclude node_modules — it is skipped automatically.`
      );
    }

    if (entry.isDirectory) continue;

    const rawName = entry.entryName;
    if (shouldSkipZipPath(rawName)) continue;

    const rel = normalizePath(rawName);
    if (!rel) continue;

    const data = entry.getData();
    if (data.length > MAX_FILE_BYTES) {
      throw new Error(`File in ZIP too large (max ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB each): ${rel}`);
    }
    totalBytes += data.length;
    if (totalBytes > MAX_ZIP_TOTAL_BYTES) {
      throw new Error(
        `Unzipped total too large (max ~${Math.round(MAX_ZIP_TOTAL_BYTES / 1024 / 1024)} MB). Remove node_modules before zipping.`
      );
    }

    const mime = extMime(rel);
    const binary = !isProbablyText(rel, mime);
    const content = binary ? data.toString('base64') : sanitizePostgresUtf8(data.toString('utf8'));
    entries.push({ path: rel, content, mime, binary });
  }

  if (entries.length === 0) {
    throw new Error(
      'ZIP had no usable files. Add source files (HTML, CSS, JS, etc.). node_modules and .git are ignored.'
    );
  }

  return entries;
}
