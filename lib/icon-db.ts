import { sql } from '@/lib/db';
import { randomUUID } from 'crypto';

export type SavedIcon = {
  id: string;
  sessionId: string | null;
  collectionId: string | null;
  name: string | null;
  slug: string | null;
  sortOrder: number | null;
  status: string | null;
  prompt: string;
  refinedPrompt: string | null;
  style: string | null;
  size: number | null;
  svg: string | null;
  pngBase64: string | null;
  provider: string | null;
  pipeline: string | null;
  createdAt: string;
};

export type IconCollection = {
  id: string;
  sessionId: string | null;
  category: string;
  style: string | null;
  size: number | null;
  status: string;
  createdAt: string;
  icons: SavedIcon[];
};

let iconTablesReady = false;

async function addColumnIfMissing(table: string, column: string, typeSql: string) {
  const rows = await sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = ${table}
      AND column_name = ${column}
  `;
  if (rows.length === 0) {
    await sql.unsafe(`ALTER TABLE ${table} ADD COLUMN ${column} ${typeSql}`);
  }
}

export async function ensureIconTables() {
  if (iconTablesReady) return;

  await sql`
    CREATE TABLE IF NOT EXISTS icon_collections (
      id VARCHAR(64) PRIMARY KEY,
      session_id VARCHAR(128),
      category TEXT NOT NULL,
      style VARCHAR(32),
      size INTEGER,
      status VARCHAR(32) DEFAULT 'planned',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS generated_icons (
      id VARCHAR(64) PRIMARY KEY,
      session_id VARCHAR(128),
      collection_id VARCHAR(64),
      name TEXT,
      slug VARCHAR(80),
      sort_order INTEGER,
      status VARCHAR(32) DEFAULT 'ready',
      prompt TEXT NOT NULL,
      refined_prompt TEXT,
      style VARCHAR(32),
      size INTEGER,
      svg TEXT,
      png_base64 TEXT,
      provider VARCHAR(64),
      pipeline VARCHAR(64),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await addColumnIfMissing('generated_icons', 'collection_id', 'VARCHAR(64)');
  await addColumnIfMissing('generated_icons', 'name', 'TEXT');
  await addColumnIfMissing('generated_icons', 'slug', 'VARCHAR(80)');
  await addColumnIfMissing('generated_icons', 'sort_order', 'INTEGER');
  await addColumnIfMissing('generated_icons', 'status', `VARCHAR(32) DEFAULT 'ready'`);

  // svg may have been NOT NULL previously; allow pending rows without art yet
  try {
    await sql.unsafe(`ALTER TABLE generated_icons ALTER COLUMN svg DROP NOT NULL`);
  } catch {
    // ignore if already nullable / no constraint
  }

  await sql`
    CREATE INDEX IF NOT EXISTS idx_generated_icons_session_created
    ON generated_icons (session_id, created_at DESC)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_generated_icons_created
    ON generated_icons (created_at DESC)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_generated_icons_collection
    ON generated_icons (collection_id, sort_order ASC)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_icon_collections_session
    ON icon_collections (session_id, created_at DESC)
  `;

  iconTablesReady = true;
}

type IconRow = {
  id: string;
  session_id: string | null;
  collection_id?: string | null;
  name?: string | null;
  slug?: string | null;
  sort_order?: number | null;
  status?: string | null;
  prompt: string;
  refined_prompt: string | null;
  style: string | null;
  size: number | null;
  svg: string | null;
  png_base64: string | null;
  provider: string | null;
  pipeline: string | null;
  created_at: Date | string;
};

function mapIconRow(row: IconRow): SavedIcon {
  return {
    id: row.id,
    sessionId: row.session_id,
    collectionId: row.collection_id ?? null,
    name: row.name ?? null,
    slug: row.slug ?? null,
    sortOrder: row.sort_order ?? null,
    status: row.status ?? null,
    prompt: row.prompt,
    refinedPrompt: row.refined_prompt,
    style: row.style,
    size: row.size,
    svg: row.svg,
    pngBase64: row.png_base64,
    provider: row.provider,
    pipeline: row.pipeline,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
  };
}

export async function createIconCollection(input: {
  sessionId?: string | null;
  category: string;
  style?: string | null;
  size?: number | null;
  ideas: Array<{ name: string; slug: string; description: string }>;
}): Promise<IconCollection> {
  await ensureIconTables();
  const id = randomUUID();
  const sessionId = input.sessionId?.trim() || null;

  await sql`
    INSERT INTO icon_collections (id, session_id, category, style, size, status)
    VALUES (
      ${id},
      ${sessionId},
      ${input.category},
      ${input.style || null},
      ${input.size ?? null},
      ${'planned'}
    )
  `;

  const icons: SavedIcon[] = [];
  for (let i = 0; i < input.ideas.length; i += 1) {
    const idea = input.ideas[i];
    const iconId = randomUUID();
    const rows = await sql<IconRow[]>`
      INSERT INTO generated_icons (
        id, session_id, collection_id, name, slug, sort_order, status,
        prompt, style, size, svg
      )
      VALUES (
        ${iconId},
        ${sessionId},
        ${id},
        ${idea.name},
        ${idea.slug},
        ${i},
        ${'pending'},
        ${idea.description},
        ${input.style || null},
        ${input.size ?? null},
        ${null}
      )
      RETURNING
        id, session_id, collection_id, name, slug, sort_order, status,
        prompt, refined_prompt, style, size, svg, png_base64, provider, pipeline, created_at
    `;
    if (rows[0]) icons.push(mapIconRow(rows[0]));
  }

  return {
    id,
    sessionId,
    category: input.category,
    style: input.style || null,
    size: input.size ?? null,
    status: 'planned',
    createdAt: new Date().toISOString(),
    icons,
  };
}

export async function saveGeneratedIcon(input: {
  sessionId?: string | null;
  collectionId?: string | null;
  iconId?: string | null;
  name?: string | null;
  slug?: string | null;
  sortOrder?: number | null;
  prompt: string;
  refinedPrompt?: string | null;
  style?: string | null;
  size?: number | null;
  svg: string;
  pngBase64?: string | null;
  provider?: string | null;
  pipeline?: string | null;
}): Promise<SavedIcon> {
  await ensureIconTables();

  if (input.iconId) {
    const rows = await sql<IconRow[]>`
      UPDATE generated_icons
      SET
        status = ${'ready'},
        refined_prompt = ${input.refinedPrompt || null},
        svg = ${input.svg},
        png_base64 = ${input.pngBase64 || null},
        provider = ${input.provider || null},
        pipeline = ${input.pipeline || null},
        name = COALESCE(${input.name || null}, name),
        slug = COALESCE(${input.slug || null}, slug)
      WHERE id = ${input.iconId}
      RETURNING
        id, session_id, collection_id, name, slug, sort_order, status,
        prompt, refined_prompt, style, size, svg, png_base64, provider, pipeline, created_at
    `;
    if (rows[0]) {
      await refreshCollectionStatus(rows[0].collection_id || null);
      return mapIconRow(rows[0]);
    }
  }

  const id = randomUUID();
  const sessionId = input.sessionId?.trim() || null;
  const rows = await sql<IconRow[]>`
    INSERT INTO generated_icons (
      id, session_id, collection_id, name, slug, sort_order, status,
      prompt, refined_prompt, style, size, svg, png_base64, provider, pipeline
    )
    VALUES (
      ${id},
      ${sessionId},
      ${input.collectionId || null},
      ${input.name || null},
      ${input.slug || null},
      ${input.sortOrder ?? null},
      ${'ready'},
      ${input.prompt},
      ${input.refinedPrompt || null},
      ${input.style || null},
      ${input.size ?? null},
      ${input.svg},
      ${input.pngBase64 || null},
      ${input.provider || null},
      ${input.pipeline || null}
    )
    RETURNING
      id, session_id, collection_id, name, slug, sort_order, status,
      prompt, refined_prompt, style, size, svg, png_base64, provider, pipeline, created_at
  `;

  const row = rows[0];
  if (!row) throw new Error('Failed to save icon');
  await refreshCollectionStatus(row.collection_id || null);
  return mapIconRow(row);
}

async function refreshCollectionStatus(collectionId: string | null) {
  if (!collectionId) return;
  const counts = await sql<{ status: string; n: string }[]>`
    SELECT status, COUNT(*)::text AS n
    FROM generated_icons
    WHERE collection_id = ${collectionId}
    GROUP BY status
  `;
  const map = Object.fromEntries(counts.map((c) => [c.status, Number(c.n)]));
  const pending = map.pending || 0;
  const failed = map.failed || 0;
  const ready = map.ready || 0;
  let status = 'planned';
  if (ready > 0 && pending === 0 && failed === 0) status = 'complete';
  else if (ready > 0) status = 'generating';
  else if (failed > 0 && pending === 0) status = 'failed';
  await sql`
    UPDATE icon_collections
    SET status = ${status}
    WHERE id = ${collectionId}
  `;
}

export async function markIconFailed(iconId: string, reason: string) {
  await ensureIconTables();
  const rows = await sql<{ collection_id: string | null }[]>`
    UPDATE generated_icons
    SET status = ${'failed'}, refined_prompt = ${reason.slice(0, 500)}
    WHERE id = ${iconId}
    RETURNING collection_id
  `;
  await refreshCollectionStatus(rows[0]?.collection_id || null);
}

export async function listGeneratedIcons(options?: {
  sessionId?: string | null;
  limit?: number;
}): Promise<SavedIcon[]> {
  await ensureIconTables();
  const limit = Math.min(Math.max(options?.limit ?? 24, 1), 100);
  const sessionId = options?.sessionId?.trim() || null;

  const rows = sessionId
    ? await sql<IconRow[]>`
        SELECT
          id, session_id, collection_id, name, slug, sort_order, status,
          prompt, refined_prompt, style, size, svg, png_base64, provider, pipeline, created_at
        FROM generated_icons
        WHERE session_id = ${sessionId} AND status = 'ready' AND svg IS NOT NULL
        ORDER BY created_at DESC
        LIMIT ${limit}
      `
    : await sql<IconRow[]>`
        SELECT
          id, session_id, collection_id, name, slug, sort_order, status,
          prompt, refined_prompt, style, size, svg, png_base64, provider, pipeline, created_at
        FROM generated_icons
        WHERE status = 'ready' AND svg IS NOT NULL
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;

  return rows.map(mapIconRow);
}

export async function getGeneratedIcon(id: string): Promise<SavedIcon | null> {
  await ensureIconTables();
  const rows = await sql<IconRow[]>`
    SELECT
      id, session_id, collection_id, name, slug, sort_order, status,
      prompt, refined_prompt, style, size, svg, png_base64, provider, pipeline, created_at
    FROM generated_icons
    WHERE id = ${id}
    LIMIT 1
  `;
  return rows[0] ? mapIconRow(rows[0]) : null;
}

export async function getIconCollection(id: string): Promise<IconCollection | null> {
  await ensureIconTables();
  const collections = await sql<
    {
      id: string;
      session_id: string | null;
      category: string;
      style: string | null;
      size: number | null;
      status: string;
      created_at: Date | string;
    }[]
  >`
    SELECT id, session_id, category, style, size, status, created_at
    FROM icon_collections
    WHERE id = ${id}
    LIMIT 1
  `;
  const collection = collections[0];
  if (!collection) return null;

  const icons = await sql<IconRow[]>`
    SELECT
      id, session_id, collection_id, name, slug, sort_order, status,
      prompt, refined_prompt, style, size, svg, png_base64, provider, pipeline, created_at
    FROM generated_icons
    WHERE collection_id = ${id}
    ORDER BY sort_order ASC NULLS LAST, created_at ASC
  `;

  return {
    id: collection.id,
    sessionId: collection.session_id,
    category: collection.category,
    style: collection.style,
    size: collection.size,
    status: collection.status,
    createdAt:
      collection.created_at instanceof Date
        ? collection.created_at.toISOString()
        : String(collection.created_at),
    icons: icons.map(mapIconRow),
  };
}

export async function listIconCollections(options?: {
  sessionId?: string | null;
  limit?: number;
  keyword?: string | null;
}): Promise<Array<Omit<IconCollection, 'icons'> & { iconCount: number; readyCount: number }>> {
  await ensureIconTables();
  const limit = Math.min(Math.max(options?.limit ?? 12, 1), 50);
  const sessionId = options?.sessionId?.trim() || null;
  const keyword = options?.keyword?.trim().toLowerCase() || null;
  const like = keyword ? `%${keyword}%` : null;

  const rows = await sql<
    {
      id: string;
      session_id: string | null;
      category: string;
      style: string | null;
      size: number | null;
      status: string;
      created_at: Date | string;
      icon_count: string;
      ready_count: string;
    }[]
  >`
    SELECT
      c.id, c.session_id, c.category, c.style, c.size, c.status, c.created_at,
      COUNT(i.id)::text AS icon_count,
      COUNT(i.id) FILTER (WHERE i.status = 'ready')::text AS ready_count
    FROM icon_collections c
    LEFT JOIN generated_icons i ON i.collection_id = c.id
    WHERE
      (${sessionId}::text IS NULL OR c.session_id = ${sessionId})
      AND (
        ${like}::text IS NULL
        OR LOWER(c.category) LIKE ${like}
        OR EXISTS (
          SELECT 1 FROM generated_icons gi
          WHERE gi.collection_id = c.id
            AND (
              LOWER(COALESCE(gi.name, '')) LIKE ${like}
              OR LOWER(COALESCE(gi.slug, '')) LIKE ${like}
              OR LOWER(gi.prompt) LIKE ${like}
            )
        )
      )
    GROUP BY c.id
    ORDER BY c.created_at DESC
    LIMIT ${limit}
  `;

  return rows.map((row) => ({
    id: row.id,
    sessionId: row.session_id,
    category: row.category,
    style: row.style,
    size: row.size,
    status: row.status,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
    iconCount: Number(row.icon_count || 0),
    readyCount: Number(row.ready_count || 0),
  }));
}
