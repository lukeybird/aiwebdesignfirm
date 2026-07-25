'use client';

import { useEffect, useId, useState } from 'react';
import Link from 'next/link';

type StyleId = 'outline' | 'filled' | 'duotone' | 'glyph';

type SetIcon = {
  id: string;
  name: string;
  slug: string;
  description: string;
  status: 'pending' | 'generating' | 'ready' | 'failed';
  sortOrder?: number | null;
  svg?: string | null;
  pngBase64?: string | null;
  error?: string | null;
  category?: string | null;
};

type PastCollection = {
  id: string;
  category: string;
  status: string;
  iconCount: number;
  readyCount: number;
};

type GalleryIcon = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  svg: string;
  pngBase64?: string | null;
  category?: string | null;
  createdAt: string;
};

const SESSION_KEY = 'icon_lab_session_v1';
const GALLERY_KEY = 'icon_lab_gallery_v1';
const SET_COUNT = 12;
const ICON_SIZE = 512;

const STYLES: { id: StyleId; label: string; hint: string }[] = [
  { id: 'filled', label: 'Filled', hint: 'Solid shapes' },
  { id: 'outline', label: 'Outline', hint: 'Thin strokes' },
  { id: 'glyph', label: 'Glyph', hint: 'Bold mark' },
  { id: 'duotone', label: 'Duotone', hint: 'Two tones' },
];

const EXAMPLES = ['baseball', 'coffee shop', 'camping', 'fintech', 'ocean sailing'];

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function getOrCreateSessionId(): string {
  try {
    const existing = window.localStorage.getItem(SESSION_KEY);
    if (existing && existing.length <= 128) return existing;
    const next = crypto.randomUUID();
    window.localStorage.setItem(SESSION_KEY, next);
    return next;
  } catch {
    return crypto.randomUUID();
  }
}

function readGallery(): GalleryIcon[] {
  try {
    const raw = window.localStorage.getItem(GALLERY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeGallery(items: GalleryIcon[]) {
  try {
    window.localStorage.setItem(GALLERY_KEY, JSON.stringify(items.slice(0, 150)));
  } catch {
    // quota / private mode
  }
}

/** Make SVG scale cleanly in the UI (black on white preview). */
function svgForPreview(svg: string): string {
  return svg
    .replace(/\swidth="[^"]*"/i, '')
    .replace(/\sheight="[^"]*"/i, '')
    .replace(/\sfill="currentColor"/gi, ' fill="#111111"')
    .replace(/stroke="rgb\(0,\s*0,\s*0\)"/gi, 'stroke="none"')
    .replace(/<svg\b/i, '<svg width="100%" height="100%" preserveAspectRatio="xMidYMid meet"');
}

function IconPreview({
  svg,
  pngBase64,
  alt,
}: {
  svg?: string | null;
  pngBase64?: string | null;
  alt: string;
}) {
  if (pngBase64) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className="icon-preview-img"
        src={`data:image/png;base64,${pngBase64}`}
        alt={alt}
      />
    );
  }
  if (svg) {
    return (
      <div
        className="icon-preview-svg-wrap"
        dangerouslySetInnerHTML={{ __html: svgForPreview(svg) }}
      />
    );
  }
  return <p className="icon-empty">No preview</p>;
}

async function mapPool<T>(items: T[], concurrency: number, worker: (item: T, index: number) => Promise<void>) {
  let next = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      await worker(items[index], index);
    }
  });
  await Promise.all(runners);
}

export default function IconMaker() {
  const formId = useId();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [category, setCategory] = useState('');
  const [style, setStyle] = useState<StyleId>('filled');
  const [collectionId, setCollectionId] = useState<string | null>(null);
  const [icons, setIcons] = useState<SetIcon[]>([]);
  const [gallery, setGallery] = useState<GalleryIcon[]>([]);
  const [pastCollections, setPastCollections] = useState<PastCollection[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [planning, setPlanning] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const readyCount = icons.filter((i) => i.status === 'ready').length;
  const failedCount = icons.filter((i) => i.status === 'failed').length;
  const selected = gallery.find((g) => g.id === selectedId) || null;

  function flash(message: string) {
    setNote(message);
    window.setTimeout(() => setNote(null), 2400);
  }

  function rememberIcon(icon: {
    id: string;
    name: string;
    slug: string;
    description?: string;
    svg: string;
    pngBase64?: string | null;
    category?: string | null;
  }) {
    const entry: GalleryIcon = {
      id: icon.id,
      name: icon.name,
      slug: icon.slug,
      description: icon.description,
      svg: icon.svg,
      pngBase64: icon.pngBase64 || null,
      category: icon.category || category.trim() || null,
      createdAt: new Date().toISOString(),
    };
    setGallery((prev) => {
      const next = [entry, ...prev.filter((p) => p.id !== entry.id && p.slug !== entry.slug)];
      writeGallery(next);
      return next;
    });
    setSelectedId(entry.id);
  }

  async function loadPast(sid: string) {
    try {
      const res = await fetch(`/api/icon/collection?sessionId=${encodeURIComponent(sid)}`);
      const data = await res.json();
      if (res.ok) setPastCollections(Array.isArray(data.collections) ? data.collections : []);
    } catch {
      // ignore
    }

    try {
      const res = await fetch(`/api/icon?sessionId=${encodeURIComponent(sid)}&limit=100`);
      const data = await res.json();
      if (!res.ok || !Array.isArray(data.icons)) return;
      const fromDb: GalleryIcon[] = data.icons
        .filter((i: { svg?: string }) => typeof i.svg === 'string' && i.svg)
        .map((i: {
          id: string;
          name?: string;
          slug?: string;
          prompt?: string;
          svg: string;
          pngBase64?: string;
          createdAt?: string;
        }) => ({
          id: i.id,
          name: i.name || i.slug || 'Icon',
          slug: i.slug || 'icon',
          description: i.prompt,
          svg: i.svg,
          pngBase64: i.pngBase64 || null,
          createdAt: i.createdAt || new Date().toISOString(),
        }));
      if (fromDb.length) {
        setGallery((prev) => {
          const map = new Map<string, GalleryIcon>();
          [...fromDb, ...prev].forEach((item) => map.set(item.id, item));
          const merged = Array.from(map.values()).sort((a, b) =>
            String(b.createdAt).localeCompare(String(a.createdAt)),
          );
          writeGallery(merged);
          return merged;
        });
      }
    } catch {
      // ignore when DB unavailable
    }
  }

  useEffect(() => {
    const sid = getOrCreateSessionId();
    setSessionId(sid);
    setGallery(readGallery());
    void loadPast(sid);
  }, []);

  function updateIcon(id: string, patch: Partial<SetIcon>) {
    setIcons((prev) => prev.map((icon) => (icon.id === id ? { ...icon, ...patch } : icon)));
  }

  async function generateOne(icon: SetIcon, activeCollectionId: string | null) {
    updateIcon(icon.id, { status: 'generating', error: null });
    try {
      const res = await fetch('/api/icon/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          prompt: icon.description,
          name: icon.name,
          slug: icon.slug,
          style,
          size: ICON_SIZE,
          sessionId,
          collectionId: activeCollectionId,
          iconId: icon.id,
          sortOrder: icon.sortOrder ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Generation failed');
      const nextId = typeof data.id === 'string' ? data.id : icon.id;
      const nextSlug = data.slug || icon.slug;
      const nextName = data.name || icon.name;
      updateIcon(icon.id, {
        id: nextId,
        status: 'ready',
        svg: data.svg,
        pngBase64: data.pngBase64,
        slug: nextSlug,
        name: nextName,
      });
      if (typeof data.svg === 'string') {
        rememberIcon({
          id: nextId,
          name: nextName,
          slug: nextSlug,
          description: icon.description,
          svg: data.svg,
          pngBase64: data.pngBase64,
          category: category.trim() || null,
        });
      }
    } catch (err) {
      updateIcon(icon.id, {
        status: 'failed',
        error: err instanceof Error ? err.message : 'Failed',
      });
    }
  }

  async function createSet(e?: React.FormEvent) {
    e?.preventDefault();
    const topic = category.trim();
    if (!topic || planning || generating) return;

    setPlanning(true);
    setError(null);
    setIcons([]);
    setCollectionId(null);

    try {
      const res = await fetch('/api/icon/collection', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ category: topic, style, size: ICON_SIZE, sessionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Could not plan icon set');

      const planned: SetIcon[] = (data.icons || []).map(
        (icon: {
          id: string;
          name: string;
          slug: string;
          description: string;
          sortOrder?: number;
        }) => ({
          id: icon.id,
          name: icon.name,
          slug: icon.slug,
          description: icon.description,
          status: 'pending',
          sortOrder: icon.sortOrder,
          category: topic,
        }),
      );

      if (planned.length < 8) throw new Error('Planner returned too few icons');

      setCollectionId(typeof data.collectionId === 'string' ? data.collectionId : null);
      setIcons(planned);
      if (data.saveError) {
        setError(`Set planned. Icons still generate even if cloud save fails.`);
      } else {
        flash(`Planned ${planned.length} ${topic} icons`);
      }

      setPlanning(false);
      setGenerating(true);

      const activeCollectionId = typeof data.collectionId === 'string' ? data.collectionId : null;
      await mapPool(planned, 2, async (icon) => {
        await generateOne(icon, activeCollectionId);
      });

      if (sessionId) void loadPast(sessionId);
      flash('Icon set complete — browse them below');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setPlanning(false);
      setGenerating(false);
    }
  }

  async function openCollection(id: string) {
    setError(null);
    try {
      const res = await fetch(`/api/icon/collection/${encodeURIComponent(id)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Could not load collection');
      setCategory(data.category || '');
      setCollectionId(data.id);
      const mapped: SetIcon[] = (data.icons || []).map(
        (icon: {
          id: string;
          name: string;
          slug: string;
          description: string;
          status: string;
          sortOrder?: number;
          svg?: string;
          pngBase64?: string;
        }) => ({
          id: icon.id,
          name: icon.name,
          slug: icon.slug,
          description: icon.description,
          status: (icon.status as SetIcon['status']) || (icon.svg ? 'ready' : 'pending'),
          sortOrder: icon.sortOrder,
          svg: icon.svg,
          pngBase64: icon.pngBase64,
        }),
      );
      setIcons(mapped);
      mapped.forEach((icon) => {
        if (icon.svg) {
          rememberIcon({
            id: icon.id,
            name: icon.name,
            slug: icon.slug,
            description: icon.description,
            svg: icon.svg,
            pngBase64: icon.pngBase64,
            category: data.category,
          });
        }
      });
      flash(`Loaded “${data.category}” set`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load set');
    }
  }

  function downloadSvg(icon: { name?: string; slug?: string; svg?: string | null }) {
    if (!icon.svg) return;
    const filename = `${icon.slug || 'icon'}.svg`;
    downloadBlob(filename, new Blob([icon.svg], { type: 'image/svg+xml;charset=utf-8' }));
    flash(`Downloaded ${filename}`);
  }

  async function downloadAllReady() {
    const ready = icons.filter((i) => i.status === 'ready' && i.svg);
    for (const icon of ready) {
      downloadSvg(icon);
      await new Promise((r) => setTimeout(r, 120));
    }
    flash(`Started ${ready.length} SVG downloads`);
  }

  async function downloadZip(source: Array<{ name: string; slug: string; svg?: string | null }>, label: string) {
    const ready = source.filter((i) => i.svg);
    if (!ready.length) return;
    try {
      const res = await fetch('/api/icon/collection/zip', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          category: label,
          icons: ready.map((icon) => ({
            name: icon.name,
            slug: icon.slug,
            svg: icon.svg,
          })),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Zip download failed');
      }
      const blob = await res.blob();
      const folder = label.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'icon-set';
      downloadBlob(`${folder}-icons.zip`, blob);
      flash(`Downloaded ZIP (${ready.length} icons)`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Zip download failed');
    }
  }

  const busy = planning || generating;

  return (
    <div className="icon-shell">
      <div className="icon-atmosphere" aria-hidden />
      <div className="icon-grid" aria-hidden />

      <header className="icon-top">
        <Link href="/" className="icon-brand-link">
          AiWebDesignFirm
        </Link>
      </header>

      <section className="icon-hero">
        <p className="icon-kicker">Icon lab</p>
        <h1 className="icon-title">Icon</h1>
        <p className="icon-lede">
          Type a category like <em>baseball</em>. We invent a dozen icons, draw each one at{' '}
          <strong>512×512</strong>, and save them so you can browse and download every SVG.
        </p>

        <form className="icon-form" onSubmit={createSet} aria-describedby={`${formId}-hint`}>
          <label className="icon-label" htmlFor={`${formId}-category`}>
            Category / collection
          </label>
          <input
            id={`${formId}-category`}
            className="icon-prompt icon-prompt-single"
            maxLength={80}
            placeholder="e.g. baseball"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            disabled={busy}
          />
          <p id={`${formId}-hint`} className="icon-hint">
            Creates {SET_COUNT} unique 512×512 SVG icons for that theme.
          </p>

          <div className="icon-examples" aria-label="Example categories">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                className="icon-chip"
                onClick={() => setCategory(ex)}
                disabled={busy}
              >
                {ex}
              </button>
            ))}
          </div>

          <div className="icon-controls">
            <fieldset className="icon-fieldset">
              <legend>Style</legend>
              <div className="icon-style-row">
                {STYLES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={`icon-style ${style === s.id ? 'is-active' : ''}`}
                    onClick={() => setStyle(s.id)}
                    disabled={busy}
                    aria-pressed={style === s.id}
                  >
                    <span>{s.label}</span>
                    <small>{s.hint}</small>
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="icon-size-fixed">
              <span>Output</span>
              <strong>512 × 512 SVG</strong>
            </div>
          </div>

          <button className="icon-generate" type="submit" disabled={busy || !category.trim()}>
            {planning
              ? 'Planning 12 icons…'
              : generating
                ? `Drawing set… ${readyCount}/${icons.length || SET_COUNT}`
                : `Generate ${SET_COUNT}-icon set`}
          </button>
        </form>
      </section>

      {error ? <p className="icon-error">{error}</p> : null}
      {note ? <p className="icon-download-note">{note}</p> : null}

      {icons.length > 0 ? (
        <section className="icon-set-stage" aria-live="polite">
          <div className="icon-stage-head">
            <div>
              <h2>{category.trim() || 'Icon'} set</h2>
              <p className="icon-library-meta">
                {readyCount} ready
                {failedCount ? ` · ${failedCount} failed` : ''}
                {' · '}512×512
              </p>
            </div>
            <div className="icon-set-toolbar">
              <button
                type="button"
                className="icon-download-primary"
                onClick={() => void downloadZip(icons, category.trim() || 'icon-set')}
                disabled={readyCount === 0}
              >
                Download ZIP
              </button>
              <button
                type="button"
                className="icon-download-secondary"
                onClick={() => void downloadAllReady()}
                disabled={readyCount === 0}
              >
                Download all SVGs
              </button>
            </div>
          </div>

          <div className="icon-set-grid">
            {icons.map((icon) => (
              <article key={icon.id} className={`icon-set-card is-${icon.status}`}>
                <div className="icon-set-art">
                  {icon.status === 'ready' && (icon.svg || icon.pngBase64) ? (
                    <IconPreview svg={icon.svg} pngBase64={icon.pngBase64} alt={icon.name} />
                  ) : icon.status === 'generating' || icon.status === 'pending' ? (
                    <div className="icon-loading compact">
                      <span className="icon-pulse" />
                      <p>{icon.status === 'generating' ? 'Drawing…' : 'Waiting…'}</p>
                    </div>
                  ) : (
                    <p className="icon-empty">Failed</p>
                  )}
                </div>
                <div className="icon-set-meta">
                  <h3>{icon.name}</h3>
                  <p>{icon.description}</p>
                  <code>{icon.slug}.svg</code>
                </div>
                <div className="icon-set-actions">
                  <button
                    type="button"
                    className="icon-download-secondary"
                    disabled={icon.status !== 'ready' || !icon.svg}
                    onClick={() => downloadSvg(icon)}
                  >
                    Download SVG
                  </button>
                  {icon.status === 'ready' ? (
                    <button
                      type="button"
                      className="icon-download-secondary"
                      onClick={() => setSelectedId(icon.id)}
                    >
                      View
                    </button>
                  ) : null}
                  {icon.status === 'failed' ? (
                    <button
                      type="button"
                      className="icon-download-secondary"
                      disabled={busy}
                      onClick={() => void generateOne(icon, collectionId)}
                    >
                      Retry
                    </button>
                  ) : null}
                </div>
                {icon.error ? <p className="icon-error tiny">{icon.error}</p> : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="icon-library" id="all-icons">
        <div className="icon-stage-head">
          <div>
            <h2>All your SVG icons</h2>
            <p className="icon-library-meta">
              {gallery.length
                ? `${gallery.length} icons saved in this browser`
                : 'Every icon you generate shows up here'}
            </p>
          </div>
          <button
            type="button"
            className="icon-download-primary"
            disabled={gallery.length === 0}
            onClick={() => void downloadZip(gallery, 'all-icons')}
          >
            Download all as ZIP
          </button>
        </div>

        {selected ? (
          <div className="icon-viewer">
            <div className="icon-viewer-art">
              <IconPreview svg={selected.svg} pngBase64={selected.pngBase64} alt={selected.name} />
            </div>
            <div className="icon-viewer-meta">
              <h3>{selected.name}</h3>
              {selected.category ? <p className="icon-viewer-cat">{selected.category}</p> : null}
              {selected.description ? <p>{selected.description}</p> : null}
              <code>{selected.slug}.svg · 512×512</code>
              <div className="icon-set-actions">
                <button
                  type="button"
                  className="icon-download-primary"
                  onClick={() => downloadSvg(selected)}
                >
                  Download {selected.slug}.svg
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {gallery.length ? (
          <div className="icon-gallery-grid">
            {gallery.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`icon-gallery-item ${selectedId === item.id ? 'is-active' : ''}`}
                onClick={() => setSelectedId(item.id)}
                title={item.name}
              >
                <div className="icon-gallery-thumb">
                  <IconPreview svg={item.svg} pngBase64={item.pngBase64} alt={item.name} />
                </div>
                <strong>{item.name}</strong>
                <span>{item.slug}.svg</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="icon-empty">No icons yet — generate a set above.</p>
        )}
      </section>

      <section className="icon-library">
        <div className="icon-stage-head">
          <h2>Past sets</h2>
          <p className="icon-library-meta">
            {pastCollections.length ? `${pastCollections.length} collections` : 'Cloud-saved sets appear here when the database is connected'}
          </p>
        </div>
        {pastCollections.length ? (
          <div className="icon-past-grid">
            {pastCollections.map((c) => (
              <button
                key={c.id}
                type="button"
                className="icon-past-item"
                onClick={() => void openCollection(c.id)}
                disabled={busy}
              >
                <strong>{c.category}</strong>
                <span>
                  {c.readyCount}/{c.iconCount} ready · {c.status}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="icon-empty">No cloud-saved sets yet.</p>
        )}
      </section>
    </div>
  );
}
