'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import Link from 'next/link';

type StyleId = 'outline' | 'filled' | 'duotone' | 'glyph';

type SetIcon = {
  id: string;
  name: string;
  slug: string;
  description: string;
  summary?: string;
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
  agencyBrief?: string | null;
  styleLook?: string | null;
  icons: SetIcon[];
};

const SESSION_KEY = 'icon_lab_session_v1';
const SETS_KEY = 'icon_lab_sets_v2';
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

function getSessionId(): string {
  try {
    const existing = window.localStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const next = crypto.randomUUID();
    window.localStorage.setItem(SESSION_KEY, next);
    return next;
  } catch {
    return crypto.randomUUID();
  }
}

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/['"]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'icon'
  );
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

function iconBlurb(icon: SetIcon): string {
  if (icon.summary) return icon.summary;
  const line = icon.description.split('\n').find((l) => l.startsWith('Communicates:'));
  return line?.replace(/^Communicates:\s*/i, '') || icon.name;
}

export default function IconMaker() {
  const formId = useId();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [category, setCategory] = useState('');
  const [style, setStyle] = useState<StyleId>('filled');
  const [collectionId, setCollectionId] = useState<string | null>(null);
  const [icons, setIcons] = useState<SetIcon[]>([]);
  const [localSets, setLocalSets] = useState<StoredSet[]>([]);
  const [agencyBrief, setAgencyBrief] = useState<string | null>(null);
  const [styleLook, setStyleLook] = useState<string | null>(null);
  const [changingId, setChangingId] = useState<string | null>(null);
  const [changeText, setChangeText] = useState('');
  const [planning, setPlanning] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [statusText, setStatusText] = useState('Waiting to start.');
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const readyCount = icons.filter((i) => i.status === 'ready').length;
  const failedCount = icons.filter((i) => i.status === 'failed').length;
  const busy = planning || generating;

  useEffect(() => {
    const id = getSessionId();
    setSessionId(id);
    try {
      const raw = window.localStorage.getItem(SETS_KEY);
      if (raw) setLocalSets(JSON.parse(raw) as StoredSet[]);
    } catch {
      // ignore
    }
  }, []);

  function flash(message: string) {
    setNote(message);
    window.setTimeout(() => setNote(null), 3200);
  }

  function persistSet( partial: Omit<StoredSet, 'createdAt'> & { createdAt?: string }) {
    setLocalSets((prev) => {
      const existing = prev.find((s) => s.id === partial.id);
      const nextSet: StoredSet = {
        id: partial.id,
        category: partial.category,
        style: partial.style,
        status: partial.status,
        createdAt: partial.createdAt || existing?.createdAt || new Date().toISOString(),
        agencyBrief: partial.agencyBrief ?? existing?.agencyBrief ?? null,
        styleLook: partial.styleLook ?? existing?.styleLook ?? null,
        icons: partial.icons,
      };
      const next = [nextSet, ...prev.filter((s) => s.id !== partial.id)].slice(0, 30);
      try {
        window.localStorage.setItem(SETS_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }

  async function generateOne(
    icon: SetIcon,
    activeCollectionId: string | null,
    changeRequest?: string,
  ) {
    setIcons((prev) =>
      prev.map((i) =>
        i.id === icon.id
          ? { ...i, status: changeRequest ? 'changing' : 'generating', error: null }
          : i,
      ),
    );

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
          sortOrder: icon.sortOrder,
          changeRequest: changeRequest || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Generate failed (HTTP ${res.status})`);

      const updated: SetIcon = {
        ...icon,
        id: typeof data.id === 'string' ? data.id : icon.id,
        description: typeof data.prompt === 'string' ? data.prompt : icon.description,
        svg: typeof data.svg === 'string' ? data.svg : null,
        pngBase64: typeof data.pngBase64 === 'string' ? data.pngBase64 : null,
        status: 'ready',
        error: null,
      };

      setIcons((prev) => {
        const next = prev.map((i) => (i.id === icon.id ? updated : i));
        if (activeCollectionId) {
          persistSet({
            id: activeCollectionId,
            category: category.trim() || 'icons',
            style,
            status: 'generating',
            agencyBrief,
            styleLook,
            icons: next,
          });
        }
        return next;
      });
      return updated;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Generate failed';
      setIcons((prev) => {
        const next = prev.map((i) =>
          i.id === icon.id ? { ...i, status: 'failed' as const, error: message } : i,
        );
        if (activeCollectionId) {
          persistSet({
            id: activeCollectionId,
            category: category.trim() || 'icons',
            style,
            status: 'generating',
            agencyBrief,
            styleLook,
            icons: next,
          });
        }
        return next;
      });
      throw err;
    }
  }

  async function createSet(e?: React.FormEvent) {
    e?.preventDefault();
    const topic = category.trim();
    if (!topic || busy) return;

    setPlanning(true);
    setGenerating(false);
    setError(null);
    setIcons([]);
    setCollectionId(null);
    setChangingId(null);
    setChangeText('');
    setAgencyBrief(null);
    setStyleLook(null);
    setStatusText('Thinking through agency communication, ideas, simplicity, and exact details…');

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
          summary?: string;
          sortOrder?: number;
        }) => ({
          id: icon.id,
          name: icon.name,
          slug: icon.slug,
          description: icon.description,
          summary: icon.summary,
          status: 'pending' as const,
          sortOrder: icon.sortOrder,
          category: topic,
        }),
      );
      if (planned.length < 8) throw new Error('Planner returned too few icons');

      const brief = typeof data.agencyBrief === 'string' ? data.agencyBrief : null;
      const look =
        typeof data.styleBible?.look === 'string' ? data.styleBible.look : null;
      const activeCollectionId =
        typeof data.collectionId === 'string' ? data.collectionId : `local-${Date.now()}`;

      setCollectionId(activeCollectionId);
      setIcons(planned);
      setAgencyBrief(brief);
      setStyleLook(look);
      persistSet({
        id: activeCollectionId,
        category: topic,
        style,
        status: 'generating',
        agencyBrief: brief,
        styleLook: look,
        icons: planned,
      });
      flash(`Strategy ready — drawing ${planned.length} icons`);
      setStatusText(`Strategy locked. Drawing icon 1 of ${planned.length}…`);

      setPlanning(false);
      setGenerating(true);

      for (let i = 0; i < planned.length; i += 1) {
        const icon = planned[i];
        setStatusText(`Drawing icon ${i + 1} of ${planned.length}: ${icon.name}`);
        try {
          await generateOne(icon, activeCollectionId);
        } catch {
          // continue remaining icons
        }
        await new Promise((r) => setTimeout(r, 800));
      }

      setIcons((current) => {
        persistSet({
          id: activeCollectionId,
          category: topic,
          style,
          status: 'complete',
          agencyBrief: brief,
          styleLook: look,
          icons: current,
        });
        return current;
      });
      setStatusText('Set complete. Use Change on any icon to remake it.');
      flash('Set complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setStatusText('Stopped.');
    } finally {
      setPlanning(false);
      setGenerating(false);
    }
  }

  async function applyChange(icon: SetIcon) {
    const request = changeText.trim();
    if (!request || busy) return;
    setError(null);
    setStatusText(`Remaking ${icon.name}…`);
    try {
      await generateOne(icon, collectionId, request);
      setChangingId(null);
      setChangeText('');
      setStatusText(`Updated ${icon.name}.`);
      flash(`Updated ${icon.name}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Remake failed');
      setStatusText('Remake failed.');
    }
  }

  async function downloadZip() {
    const ready = icons.filter((i) => i.svg);
    if (!ready.length) return;
    try {
      const res = await fetch('/api/icon/collection/zip', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          category: category.trim() || 'icon-set',
          icons: ready.map((icon) => ({
            name: icon.name,
            slug: icon.slug,
            svg: icon.svg,
          })),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `ZIP failed (HTTP ${res.status})`);
      }
      const blob = await res.blob();
      downloadBlob(`${slugify(category || 'icons')}-set.zip`, blob);
      flash(`Downloaded ZIP with ${ready.length} icons`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ZIP download failed');
    }
  }

  function openSavedSet(set: StoredSet) {
    setError(null);
    setChangingId(null);
    setChangeText('');
    setCategory(set.category);
    setCollectionId(set.id);
    setIcons(set.icons);
    setAgencyBrief(set.agencyBrief || null);
    setStyleLook(set.styleLook || null);
    setStatusText(`Opened “${set.category}” set.`);
    flash(`Opened “${set.category}”`);
  }

  const progressLabel = useMemo(() => {
    if (planning) return 'Planning strategy…';
    if (generating) return `Drawing… ${readyCount}/${icons.length || SET_COUNT}`;
    if (icons.length) return `${readyCount} ready${failedCount ? ` · ${failedCount} failed` : ''}`;
    return null;
  }, [planning, generating, readyCount, failedCount, icons.length]);

  return (
    <div className="icon-shell">
      <header className="icon-top">
        <Link href="/" className="icon-brand-link">
          AiWebDesignFirm
        </Link>
      </header>

      <section className="icon-hero">
        <p className="icon-kicker">Icon Lab</p>
        <h1 className="icon-title">Icon</h1>
        <p className="icon-lede">
          Type a category. We decide what it must communicate as an agency, which icons carry those
          ideas, how to keep each mark simple and beautiful, lock exact display details, then draw
          twelve 512×512 SVGs. Use <strong>Change</strong> on any finished icon to remake it.
        </p>

        <form className="icon-form" onSubmit={createSet}>
          <label className="icon-label" htmlFor={`${formId}-category`}>
            Category
          </label>
          <input
            id={`${formId}-category`}
            className="icon-prompt icon-prompt-single"
            maxLength={80}
            placeholder="e.g. baseball training academy"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            disabled={busy}
          />

          <div className="icon-style-row" role="group" aria-label="Icon style">
            {STYLES.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`icon-style${style === option.id ? ' is-active' : ''}`}
                disabled={busy}
                onClick={() => setStyle(option.id)}
              >
                {option.label}
                <small>{option.hint}</small>
              </button>
            ))}
          </div>

          <div className="icon-examples">
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                className="icon-chip"
                disabled={busy}
                onClick={() => setCategory(example)}
              >
                {example}
              </button>
            ))}
          </div>

          <button type="submit" className="icon-generate" disabled={busy || !category.trim()}>
            {busy ? progressLabel || 'Working…' : 'Make icon set'}
          </button>
        </form>

        <p className="icon-hint">{statusText}</p>
        {note ? <p className="icon-note">{note}</p> : null}
        {error ? <p className="icon-error">{error}</p> : null}
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
                {busy ? ` · ${progressLabel}` : ''}
              </p>
              {agencyBrief ? <p className="icon-strategy-brief">{agencyBrief}</p> : null}
              {styleLook ? <p className="icon-strategy-style">{styleLook}</p> : null}
            </div>
            <div className="icon-set-toolbar">
              <button
                type="button"
                className="icon-download-primary"
                onClick={() => void downloadZip()}
                disabled={readyCount === 0}
              >
                Download ZIP
              </button>
            </div>
          </div>

          <div className="icon-set-grid">
            {icons.map((icon) => (
              <article key={icon.id} className={`icon-set-card is-${icon.status}`}>
                <div className="icon-set-art">
                  {icon.status === 'ready' && (icon.svg || icon.pngBase64) ? (
                    <IconPreview svg={icon.svg} pngBase64={icon.pngBase64} alt={icon.name} />
                  ) : icon.status === 'generating' ||
                    icon.status === 'pending' ||
                    icon.status === 'changing' ? (
                    <div className="icon-loading compact">
                      <span className="icon-pulse" />
                      <p>
                        {icon.status === 'changing'
                          ? 'Updating…'
                          : icon.status === 'generating'
                            ? 'Drawing…'
                            : 'Waiting…'}
                      </p>
                    </div>
                  ) : (
                    <p className="icon-empty">Failed</p>
                  )}
                </div>
                <div className="icon-set-meta">
                  <h3>{icon.name}</h3>
                  <p>{iconBlurb(icon)}</p>
                  <code>{icon.slug}.svg</code>
                </div>
                <div className="icon-set-actions">
                  <button
                    type="button"
                    className="icon-download-secondary"
                    disabled={!icon.svg}
                    onClick={() =>
                      icon.svg &&
                      downloadBlob(
                        `${icon.slug}.svg`,
                        new Blob([icon.svg], { type: 'image/svg+xml;charset=utf-8' }),
                      )
                    }
                  >
                    Download SVG
                  </button>
                  {icon.status === 'ready' || icon.status === 'failed' ? (
                    <button
                      type="button"
                      className="icon-download-primary"
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
                      What should change about this icon?
                    </label>
                    <textarea
                      id={`change-${icon.id}`}
                      className="icon-change-input"
                      rows={3}
                      maxLength={800}
                      placeholder="e.g. thicker handle, remove stitching, simpler silhouette"
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

      <section className="icon-library">
        <div className="icon-stage-head">
          <h2>Your sets</h2>
          <p className="icon-library-meta">
            {localSets.length ? `${localSets.length} saved in this browser` : 'Completed sets appear here'}
          </p>
        </div>
        {localSets.length ? (
          <div className="icon-past-grid">
            {localSets.map((set) => (
              <button
                key={set.id}
                type="button"
                className={`icon-past-item${collectionId === set.id ? ' is-active-set' : ''}`}
                onClick={() => openSavedSet(set)}
                disabled={busy}
              >
                <strong>{set.category}</strong>
                <span>
                  {set.icons.filter((i) => i.status === 'ready').length}/{set.icons.length || SET_COUNT}{' '}
                  ready
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="icon-empty">No saved sets yet.</p>
        )}
      </section>
    </div>
  );
}
