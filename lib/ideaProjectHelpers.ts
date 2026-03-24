import { sql, initDatabase } from '@/lib/db';

/** Max size per file inside a project (ZIP / folder / manual). */
export const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15 MB per file
export const MAX_ZIP_FILES = 1000;
/** Max total unzipped payload stored in DB for one project. */
export const MAX_ZIP_TOTAL_BYTES = 120 * 1024 * 1024; // ~120 MB total unzipped
/** Max ZIP file bytes accepted via direct FormData (often hits Vercel ~4.5MB before this). */
export const MAX_ZIP_UPLOAD_BYTES = 100 * 1024 * 1024; // 100 MB when Blob upload is used

export type IdeaFileEntry = {
  path: string;
  content: string;
  mime: string;
  binary: boolean;
};

/** PostgreSQL UTF-8 TEXT cannot contain null bytes (0x00). */
export function sanitizePostgresUtf8(s: string): string {
  if (typeof s !== 'string' || !s.includes('\0')) return s;
  return s.replace(/\0/g, '');
}

const TEXT_EXT = new Set([
  'html', 'htm', 'css', 'js', 'mjs', 'cjs', 'json', 'txt', 'xml', 'svg', 'md', 'map', 'tsx', 'ts', 'jsx',
]);

/** Stored on idea_projects; optional external or path URL for “open live site”. */
export const MAX_LIVE_LINK_LEN = 2048;

export function parseLiveLinkInput(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (s === '') return null;
  if (s.length > MAX_LIVE_LINK_LEN) {
    throw new Error(`Link is too long (max ${MAX_LIVE_LINK_LEN} characters)`);
  }
  const lower = s.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('file:')
  ) {
    throw new Error('Invalid link');
  }
  return s;
}

export function sanitizeSlug(raw: string): string {
  const s = raw
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
  return s || 'project';
}

export function normalizePath(p: string): string | null {
  const parts = p.split(/[/\\]+/).filter(Boolean);
  if (parts.some((x) => x === '..' || x === '.')) return null;
  return parts.join('/');
}

export function shouldSkipZipPath(path: string): boolean {
  const norm = path.replace(/\\/g, '/').replace(/^\/+/, '');
  const lower = norm.toLowerCase();
  const segments = lower.split('/');
  if (segments.some((s) => s === 'node_modules' || s === '.git' || s === '__pycache__' || s === '.next')) {
    return true;
  }
  if (lower.startsWith('node_modules/') || lower.startsWith('.git/')) return true;
  return false;
}

export function extMime(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    html: 'text/html; charset=utf-8',
    htm: 'text/html; charset=utf-8',
    css: 'text/css; charset=utf-8',
    js: 'application/javascript; charset=utf-8',
    mjs: 'application/javascript; charset=utf-8',
    tsx: 'text/typescript; charset=utf-8',
    ts: 'text/typescript; charset=utf-8',
    jsx: 'text/javascript; charset=utf-8',
    json: 'application/json; charset=utf-8',
    svg: 'image/svg+xml',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    ico: 'image/x-icon',
    woff: 'font/woff',
    woff2: 'font/woff2',
    ttf: 'font/ttf',
    map: 'application/json',
    md: 'text/markdown; charset=utf-8',
  };
  return map[ext] || 'application/octet-stream';
}

export function isProbablyText(path: string, mime: string): boolean {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  if (mime.startsWith('text/') || mime.includes('javascript') || mime.includes('json') || mime.includes('svg+xml') || mime.includes('typescript')) return true;
  return TEXT_EXT.has(ext);
}

export async function insertIdeaProject(
  slug: string,
  displayName: string,
  entries: IdeaFileEntry[]
): Promise<{ slug: string; name: string; fileCount: number }> {
  if (entries.length === 0) {
    throw new Error('No files to upload');
  }

  try {
    const existing = await sql`SELECT id FROM idea_projects WHERE slug = ${slug}`;
    if (existing.length > 0) {
      throw new Error(`Slug "${slug}" already exists. Pick another URL name.`);
    }

    const [proj] = await sql`
      INSERT INTO idea_projects (slug, name)
      VALUES (${slug}, ${displayName})
      RETURNING id, slug, name
    `;
    const projectId = (proj as { id: number }).id;

    for (const e of entries) {
      const safeContent = e.binary ? e.content : sanitizePostgresUtf8(e.content);
      await sql`
        INSERT INTO idea_project_files (project_id, file_path, content, mime_type, is_binary)
        VALUES (${projectId}, ${e.path}, ${safeContent}, ${e.mime}, ${e.binary})
      `;
    }

    return { slug, name: displayName, fileCount: entries.length };
  } catch (dbError: any) {
    if (dbError?.message?.includes('idea_projects') && dbError?.message?.includes('does not exist')) {
      await initDatabase();
      throw new Error('Database was just initialized. Please try again.');
    }
    if (dbError?.message?.includes('already exists')) throw dbError;
    throw dbError;
  }
}
