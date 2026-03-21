import { sql, initDatabase } from '@/lib/db';

export const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB per file
export const MAX_ZIP_FILES = 1000;
export const MAX_ZIP_TOTAL_BYTES = 45 * 1024 * 1024; // ~45 MB total unzipped

export type IdeaFileEntry = {
  path: string;
  content: string;
  mime: string;
  binary: boolean;
};

const TEXT_EXT = new Set([
  'html', 'htm', 'css', 'js', 'mjs', 'cjs', 'json', 'txt', 'xml', 'svg', 'md', 'map', 'tsx', 'ts', 'jsx',
]);

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
      await sql`
        INSERT INTO idea_project_files (project_id, file_path, content, mime_type, is_binary)
        VALUES (${projectId}, ${e.path}, ${e.content}, ${e.mime}, ${e.binary})
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
