'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import Link from 'next/link';

type StyleId = 'outline' | 'filled' | 'duotone' | 'glyph';

type SetIcon = {
  id: string;
  name: string;
  slug: string;
  description: string;
  status: 'pending' | 'generating' | 'ready' | 'failed' | 'changing';
  sortOrder?: number | null;
  svg?: string | null;
  pngBase64?: string | null;
  error?: string | null;
  category?: string | null;
};

type StoredSet = {
  id: string;
  category: string;
  style: string;
  status: string;
  createdAt: string;
  icons: SetIcon[];
};

const SESSION_KEY = 'icon_lab_session_v1';
const SETS_KEY = 'icon_lab_sets_v1';
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

function readSets(): StoredSet[] {
  try {
    const raw = window.localStorage.getItem(SETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeSets(sets: StoredSet[]) {
  try {
    window.localStorage.setItem(SETS_KEY, JSON.stringify(sets.slice(0, 40)));
  } catch {
    // ignore quota
  }
}

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
      <img className="icon-preview-img" src={`data:image/png;base64,${pngBase64}`} alt={alt} />
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

function matchesKeyword(haystack: string, keyword: string): boolean {
  if (!keyword) return true;
  return haystack.toLowerCase().includes(keyword.toLowerCase());
}

export default function IconMaker() {
  const formId = useId();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [category, setCategory] = useState('');
  const [style, setStyle] = useState<StyleId>('filled');
  const [collectionId, setCollectionId] = useState<string | null>(null);
  const [icons, setIcons] = useState<SetIcon[]>([]);
  const [localSets, setLocalSets] = useState<StoredSet[]>([]);
  const [cloudSets, setCloudSets] = useState<
    Array<{ id: string; category: string; status: string; iconCount: number; readyCount: number }>
  >([]);
  const [search, setSearch] = useState('');
  const [planning, setPlanning] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [changingId, setChangingId] = useState<string | null>(null);
  const [changeText, setChangeText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const readyCount = icons.filter((i) => i.status === 'ready').length;
  const failedCount = icons.filter((i) => i.status === 'failed').length;
  const busy = planning || generating;

  const mergedSets = useMemo(() => {
    const map = new Map<string, StoredSet>();
    localSets.forEach((s) => map.set(s.id, s));
    // Cloud-only metadata sets (no icons yet) as placeholders
    cloudSets.forEach((c) => {
      if (!map.has(c.id)) {
        map.set(c.id, {
          id: c.id,
          category: c.category,
          style: 'filled',
          status: c.status,
          createdAt: new Date().toISOString(),
          icons: [],
        });
      } else {
        const existing = map.get(c.id)!;
        map.set(c.id, {
          ...existing,
          status: c.status || existing.status,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [localSets, cloudSets]);

  const filteredSets = useMemo(() => {
    const q = search.trim();
    if (!q) return mergedSets;
    return mergedSets.filter((set) => {
      const blob = [
        set.category,
        ...set.icons.map((i) => `${i.name} ${i.slug} ${i.description}`),
      ].join(' ');
      return matchesKeyword(blob, q);
    });
  }, [mergedSets, search]);

  const filteredIconsInView = useMemo(() => {
    const q = search.trim();
    if (!q || icons.length === 0) return icons;
    // When viewing a set, also allow filtering icons inside it by keyword
    return icons.filter((i) =>
      matchesKeyword(`${i.name} ${i.slug} ${i.description} ${category}`, q),
    );
  }, [icons, search, category]);

  function flash(message: string) {
    setNote(message);
    window.setTimeout(() => setNote(null), 2400);
  }

  function persistSet(next: {
    id: string;
    category: string;
    style: string;
    status: string;
    icons: SetIcon[];
  }) {
    const stored: StoredSet = {
      id: next.id,
      category: next.category,
      style: next.style,
      status: next.status,
      createdAt: new Date().toISOString(),
      icons: next.icons,
    };
    setLocalSets((prev) => {
      const merged = [stored, ...prev.filter((p) => p.id !== stored.id)];
      writeSets(merged);
      return merged;
    });
  }

  async function loadCloudSets(sid: string, q?: string) {
    try {
      const params = new URLSearchParams({ sessionId: sid, limit: '40' });
      if (q?.trim()) params.set('q', q.trim());
      const res = await fetch(`/api/icon/collection?${params.toString()}`);
      const data = await res.json();
      if (res.ok) setCloudSets(Array.isArray(data.collections) ? data.collections : []);
    } catch {
      // ignore when DB unavailable
    }
  }

  useEffect(() => {
    const sid = getOrCreateSessionId();
    setSessionId(sid);
    setLocalSets(readSets());
    void loadCloudSets(sid);
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    const t = window.setTimeout(() => {
      void loadCloudSets(sessionId, search);
    }, 250);
    return () => window.clearTimeout(t);
  }, [search, sessionId]);

  function updateIcon(id: string, patch: Partial<SetIcon>) {
    setIcons((prev) => {
      const next = prev.map((icon) => (icon.id === id ? { ...icon, ...patch } : icon));
      if (collectionId) {
        const ready = next.filter((i) => i.status === 'ready').length;
        persistSet({
          id: collectionId,
          category: category.trim() || 'set',
          style,
          status: ready === next.length ? 'complete' : 'generating',
          icons: next,
        });
      }
      return next;
    });
  }

  async function generateOne(
    icon: SetIcon,
    activeCollectionId: string | null,
    changeRequest?: string,
  ) {
    updateIcon(icon.id, {
      status: changeRequest ? 'changing' : 'generating',
      error: null,
    });
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
          changeRequest: changeRequest || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Generation failed');
      updateIcon(icon.id, {
        id: typeof data.id === 'string' ? data.id : icon.id,
        status: 'ready',
        svg: data.svg,
        pngBase64: data.pngBase64,
        slug: data.slug || icon.slug,
        name: data.name || icon.name,
        description: typeof data.prompt === 'string' ? data.prompt : icon.description,
      });
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
    if (!topic || busy) return;

    setPlanning(true);
    setError(null);
    setIcons([]);
    setCollectionId(null);
    setChangingId(null);

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
          status: 'pending' as const,
          sortOrder: icon.sortOrder,
          category: topic,
        }),
      );
      if (planned.length < 8) throw new Error('Planner returned too few icons');

      const activeCollectionId =
        typeof data.collectionId === 'string' ? data.collectionId : `local-${Date.now()}`;
      setCollectionId(activeCollectionId);
      setIcons(planned);
      persistSet({
        id: activeCollectionId,
        category: topic,
        style,
        status: 'generating',
        icons: planned,
      });
      flash(`Planned ${planned.length} ${topic} icons`);

      setPlanning(false);
      setGenerating(true);

      for (const icon of planned) {
        await generateOne(icon, activeCollectionId);
        await new Promise((r) => setTimeout(r, 800));
      }

      if (sessionId) void loadCloudSets(sessionId, search);
      flash('Set complete — find it in Your sets below');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setPlanning(false);
      setGenerating(false);
    }
  }

  async function openSet(set: StoredSet) {
    setError(null);
    setChangingId(null);
    setChangeText('');

    // Prefer fully hydrated local set
    if (set.icons.length > 0) {
      setCategory(set.category);
      setCollectionId(set.id);
      setIcons(set.icons);
      flash(`Opened “${set.category}” set`);
      return;
    }

    // Cloud set without local icons — fetch
    try {
      const res = await fetch(`/api/icon/collection/${encodeURIComponent(set.id)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Could not load set');
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
          category: data.category,
        }),
      );
      setCategory(data.category || set.category);
      setCollectionId(data.id);
      setIcons(mapped);
      persistSet({
        id: data.id,
        category: data.category || set.category,
        style: data.style || style,
        status: data.status || 'complete',
        icons: mapped,
      });
      flash(`Opened “${data.category}” set`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open set');
    }
  }

  async function applyChange(icon: SetIcon) {
    const request = changeText.trim();
    if (!request || busy) return;
    setChangingId(null);
    setGenerating(true);
    try {
      await generateOne(icon, collectionId, request);
      flash(`Updated ${icon.name}`);
    } finally {
      setGenerating(false);
      setChangeText('');
    }
  }

  function downloadSvg(icon: { slug?: string; svg?: string | null }) {
    if (!icon.svg) return;
    const filename = `${icon.slug || 'icon'}.svg`;
    downloadBlob(filename, new Blob([icon.svg], { type: 'image/svg+xml;charset=utf-8' }));
    flash(`Downloaded ${filename}`);
  }

  async function downloadZip(
    source: Array<{ name: string; slug: string; svg?: string | null }>,
    label: string,
  ) {
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
          Type a category like <em>baseball</em>. We invent a dozen 512×512 icons, save the set, and let you
          browse by keyword or open any set to revise individual icons.
        </p>

        <form className="icon-form" onSubmit={createSet}>
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
          <p className="icon-hint">Creates {SET_COUNT} unique SVG icons for that theme, one at a time.</p>

          <div className="icon-examples">
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

      <section className="icon-library" id="your-sets">
        <div className="icon-stage-head">
          <div>
            <h2>Your sets</h2>
            <p className="icon-library-meta">
              Browse by keyword, open a set, then download or change individual icons.
            </p>
          </div>
        </div>

        <label className="icon-label" htmlFor={`${formId}-search`}>
          Search keywords
        </label>
        <input
          id={`${formId}-search`}
          className="icon-prompt icon-prompt-single"
          placeholder="Search sets or icons — e.g. bat, coffee, camping"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {filteredSets.length ? (
          <div className="icon-past-grid" style={{ marginTop: '1rem' }}>
            {filteredSets.map((set) => {
              const ready = set.icons.filter((i) => i.status === 'ready').length || 0;
              const total = set.icons.length || SET_COUNT;
              const active = collectionId === set.id;
              return (
                <button
                  key={set.id}
                  type="button"
                  className={`icon-past-item ${active ? 'is-active-set' : ''}`}
                  onClick={() => void openSet(set)}
                  disabled={busy}
                >
                  <strong>{set.category}</strong>
                  <span>
                    {ready}/{total} ready · {set.status}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="icon-empty" style={{ marginTop: '1rem' }}>
            No sets match that search yet.
          </p>
        )}
      </section>

      {icons.length > 0 ? (
        <section className="icon-set-stage" aria-live="polite">
          <div className="icon-stage-head">
            <div>
              <h2>{category.trim() || 'Icon'} set</h2>
              <p className="icon-library-meta">
                {readyCount} ready
                {failedCount ? ` · ${failedCount} failed` : ''}
                {' · '}512×512
                {search.trim() ? ` · filtered to ${filteredIconsInView.length}` : ''}
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
            </div>
          </div>

          <div className="icon-set-grid">
            {filteredIconsInView.map((icon) => (
              <article key={icon.id} className={`icon-set-card is-${icon.status}`}>
                <div className="icon-set-art">
                  {['ready', 'changing'].includes(icon.status) && (icon.svg || icon.pngBase64) ? (
                    <IconPreview svg={icon.svg} pngBase64={icon.pngBase64} alt={icon.name} />
                  ) : icon.status === 'generating' || icon.status === 'pending' ? (
                    <div className="icon-loading compact">
                      <span className="icon-pulse" />
                      <p>{icon.status === 'generating' ? 'Drawing…' : 'Waiting…'}</p>
                    </div>
                  ) : icon.status === 'changing' ? (
                    <div className="icon-loading compact">
                      <span className="icon-pulse" />
                      <p>Updating…</p>
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
                    disabled={!icon.svg}
                    onClick={() => downloadSvg(icon)}
                  >
                    Download SVG
                  </button>
                  {icon.status === 'ready' || icon.status === 'failed' ? (
                    <button
                      type="button"
                      className="icon-download-secondary"
                      disabled={busy}
                      onClick={() => {
                        setChangingId(icon.id);
                        setChangeText('');
                      }}
                    >
                      Change
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

                {changingId === icon.id ? (
                  <div className="icon-change-box">
                    <label className="icon-label" htmlFor={`change-${icon.id}`}>
                      Describe the change
                    </label>
                    <textarea
                      id={`change-${icon.id}`}
                      className="icon-change-input"
                      rows={3}
                      maxLength={500}
                      placeholder="e.g. make the bat thicker, simpler silhouette"
                      value={changeText}
                      onChange={(e) => setChangeText(e.target.value)}
                      disabled={busy}
                    />
                    <div className="icon-set-actions">
                      <button
                        type="button"
                        className="icon-download-primary"
                        disabled={busy || !changeText.trim()}
                        onClick={() => void applyChange(icon)}
                      >
                        Remake icon
                      </button>
                      <button
                        type="button"
                        className="icon-download-secondary"
                        disabled={busy}
                        onClick={() => {
                          setChangingId(null);
                          setChangeText('');
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}

                {icon.error ? <p className="icon-error tiny">{icon.error}</p> : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
