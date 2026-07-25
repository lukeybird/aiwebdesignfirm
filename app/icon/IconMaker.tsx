'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  buildIconProductionBrief,
  estimateRemainingSeconds,
  formatEta,
  pairIdeas,
  slugifyTitle,
  TOURNAMENT_STAGES,
  type TournamentIdea,
  type TournamentStageId,
} from '@/lib/icon-tournament';

type FinalIcon = {
  id: string;
  title: string;
  slug: string;
  look: string;
  summary?: string;
  description?: string;
  svg?: string | null;
  pngBase64?: string | null;
  status: 'pending' | 'drawing' | 'ready' | 'failed' | 'changing';
  error?: string | null;
};

type LogLine = {
  id: string;
  at: number;
  stage: string;
  text: string;
  tone?: 'info' | 'ok' | 'warn' | 'error';
};

const SESSION_KEY = 'icon_lab_session_v1';
const SETS_KEY = 'icon_lab_tournament_sets_v1';

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

async function tournamentCall(body: Record<string, unknown> & { uiStage?: string }) {
  const res = await fetch('/api/icon/tournament', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  let data: Record<string, unknown> = {};
  try {
    data = await res.json();
  } catch {
    const error = new Error(
      `Tournament API returned non-JSON (HTTP ${res.status}). The server may have timed out or crashed.`,
    ) as Error & { stage?: string };
    error.stage = body.uiStage || String(body.action || 'unknown');
    throw error;
  }
  if (!res.ok || data.ok === false) {
    const stage =
      body.uiStage ||
      (typeof data.stage === 'string' ? data.stage : String(body.action || 'unknown'));
    const err = typeof data.error === 'string' ? data.error : `Request failed (HTTP ${res.status})`;
    const error = new Error(err) as Error & { stage?: string };
    error.stage = stage;
    throw error;
  }
  return data;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export default function IconMaker() {
  const formId = useId();
  const abortRef = useRef(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [category, setCategory] = useState('');
  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState<TournamentStageId>('idle');
  const [stageProgress, setStageProgress] = useState(0);
  const [stageTotal, setStageTotal] = useState(0);
  const [statusText, setStatusText] = useState('Waiting to start.');
  const [lastMatch, setLastMatch] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorStage, setErrorStage] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [pool, setPool] = useState<TournamentIdea[]>([]);
  const [finalists, setFinalists] = useState<FinalIcon[]>([]);
  const [agencyBrief, setAgencyBrief] = useState<string | null>(null);
  const [changingId, setChangingId] = useState<string | null>(null);
  const [changeText, setChangeText] = useState('');
  const [savedSets, setSavedSets] = useState<
    Array<{ id: string; category: string; createdAt: string; icons: FinalIcon[] }>
  >([]);

  const stageMeta = TOURNAMENT_STAGES.find((s) => s.id === stage);
  const etaSeconds = useMemo(
    () => estimateRemainingSeconds(stage, stageProgress, stageTotal),
    [stage, stageProgress, stageTotal],
  );

  useEffect(() => {
    setSessionId(getSessionId());
    try {
      const raw = window.localStorage.getItem(SETS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setSavedSets(parsed);
      }
    } catch {
      // ignore
    }
  }, []);

  function pushLog(stageName: string, text: string, tone: LogLine['tone'] = 'info') {
    setLogs((prev) =>
      [
        {
          id: crypto.randomUUID(),
          at: Date.now(),
          stage: stageName,
          text,
          tone,
        },
        ...prev,
      ].slice(0, 80),
    );
  }

  function mark(stageId: TournamentStageId, progress: number, total: number, text: string) {
    setStage(stageId);
    setStageProgress(progress);
    setStageTotal(total);
    setStatusText(text);
  }

  async function runTournament(e?: React.FormEvent) {
    e?.preventDefault();
    const topic = category.trim();
    if (!topic || running) return;

    abortRef.current = false;
    setRunning(true);
    setError(null);
    setErrorStage(null);
    setLastMatch(null);
    setFinalists([]);
    setPool([]);
    setLogs([]);
    setAgencyBrief(null);
    setChangingId(null);
    setChangeText('');

    try {
      // 1) 96 ideas
      mark('ideas', 0, 1, 'Deciding what this category must communicate, then listing 96 icons…');
      pushLog('ideas', `Starting agency discovery for “${topic}”.`);
      const ideasRes = await tournamentCall({ action: 'ideas', category: topic, uiStage: 'ideas' });
      if (abortRef.current) return;
      const ideas = (ideasRes.icons as TournamentIdea[]) || [];
      if (ideas.length < 96) {
        throw Object.assign(new Error(`Only received ${ideas.length}/96 ideas.`), { stage: 'ideas' });
      }
      if (typeof ideasRes.agencyBrief === 'string' && ideasRes.agencyBrief.trim()) {
        setAgencyBrief(ideasRes.agencyBrief.trim());
      }
      setPool(ideas);
      mark('ideas', 1, 1, `Got ${ideas.length} icon types.`);
      pushLog('ideas', `Collected ${ideas.length} communication-driven icon types.`, 'ok');
      await sleep(400);

      // 2) Round 1 usefulness → 48
      const pairs1 = pairIdeas(ideas);
      mark('round1', 0, pairs1.length, `Usefulness tournament: 0/${pairs1.length} matches…`);
      pushLog('round1', `Starting ${pairs1.length} usefulness matches (96 → 48).`);
      const winners1: TournamentIdea[] = [];
      for (let i = 0; i < pairs1.length; i += 1) {
        if (abortRef.current) return;
        const [a, b] = pairs1[i];
        mark(
          'round1',
          i,
          pairs1.length,
          `Round 1 match ${i + 1}/${pairs1.length}: “${a.title}” vs “${b.title}”…`,
        );
        const match = await tournamentCall({
          action: 'match',
          category: topic,
          criterion: 'usefulness',
          a,
          b,
          uiStage: 'round1',
        });
        const winner = match.winner as TournamentIdea;
        winners1.push(winner);
        setLastMatch(
          `${a.title} vs ${b.title} → ${winner.title}${match.reason ? ` (${match.reason})` : ''}`,
        );
        setPool([...winners1]);
        mark(
          'round1',
          i + 1,
          pairs1.length,
          `Round 1 match ${i + 1}/${pairs1.length} complete. Winner: ${winner.title}`,
        );
        await sleep(250);
      }
      pushLog('round1', `48 usefulness winners selected.`, 'ok');

      // 3) Enrich each of 48
      mark('enrich', 0, winners1.length, 'Deepening idea #1…');
      pushLog('enrich', `Enriching ${winners1.length} ideas one by one.`);
      const enriched: TournamentIdea[] = [];
      for (let i = 0; i < winners1.length; i += 1) {
        if (abortRef.current) return;
        mark('enrich', i, winners1.length, `Enriching idea ${i + 1}/${winners1.length}: ${winners1[i].title}`);
        const res = await tournamentCall({
          action: 'enrich',
          category: topic,
          idea: winners1[i],
          uiStage: 'enrich',
        });
        const idea = res.idea as TournamentIdea;
        enriched.push(idea);
        setPool([...enriched]);
        mark('enrich', i + 1, winners1.length, `Enriched ${i + 1}/${winners1.length}: ${idea.title}`);
        await sleep(250);
      }
      pushLog('enrich', `All 48 ideas now have fuller descriptions.`, 'ok');

      // 4) Round 2 best idea → 24
      const pairs2 = pairIdeas(enriched);
      mark('round2', 0, pairs2.length, `Best-idea tournament: 0/${pairs2.length}…`);
      pushLog('round2', `Starting ${pairs2.length} best-idea matches (48 → 24).`);
      const winners2: TournamentIdea[] = [];
      for (let i = 0; i < pairs2.length; i += 1) {
        if (abortRef.current) return;
        const [a, b] = pairs2[i];
        mark('round2', i, pairs2.length, `Round 2 match ${i + 1}/${pairs2.length}: “${a.title}” vs “${b.title}”…`);
        const match = await tournamentCall({
          action: 'match',
          category: topic,
          criterion: 'idea',
          a,
          b,
          uiStage: 'round2',
        });
        const winner = match.winner as TournamentIdea;
        winners2.push(winner);
        setLastMatch(
          `${a.title} vs ${b.title} → ${winner.title}${match.reason ? ` (${match.reason})` : ''}`,
        );
        setPool([...winners2]);
        mark('round2', i + 1, pairs2.length, `Round 2 complete ${i + 1}/${pairs2.length}. Winner: ${winner.title}`);
        await sleep(250);
      }
      pushLog('round2', `24 strongest ideas remain.`, 'ok');

      // 5) Visualize each of 24
      mark('visualize', 0, winners2.length, 'Writing simplest look for icon #1…');
      pushLog('visualize', `Defining exact simple visuals for ${winners2.length} icons.`);
      const visualized: TournamentIdea[] = [];
      for (let i = 0; i < winners2.length; i += 1) {
        if (abortRef.current) return;
        mark(
          'visualize',
          i,
          winners2.length,
          `Simplifying look ${i + 1}/${winners2.length}: ${winners2[i].title}`,
        );
        const res = await tournamentCall({
          action: 'visualize',
          category: topic,
          idea: winners2[i],
          uiStage: 'visualize',
        });
        const idea = res.idea as TournamentIdea;
        visualized.push(idea);
        setPool([...visualized]);
        mark(
          'visualize',
          i + 1,
          winners2.length,
          `Look ready ${i + 1}/${winners2.length}: ${idea.title}`,
        );
        await sleep(250);
      }
      pushLog('visualize', `All 24 now have exact simple look descriptions.`, 'ok');

      // 6) Round 3 simplicity → 12
      const pairs3 = pairIdeas(visualized);
      mark('round3', 0, pairs3.length, `Simplicity tournament: 0/${pairs3.length}…`);
      pushLog('round3', `Starting ${pairs3.length} simplicity matches (24 → 12).`);
      const winners3: TournamentIdea[] = [];
      for (let i = 0; i < pairs3.length; i += 1) {
        if (abortRef.current) return;
        const [a, b] = pairs3[i];
        mark(
          'round3',
          i,
          pairs3.length,
          `Round 3 match ${i + 1}/${pairs3.length}: “${a.title}” vs “${b.title}”…`,
        );
        const match = await tournamentCall({
          action: 'match',
          category: topic,
          criterion: 'simplicity',
          a,
          b,
          uiStage: 'round3',
        });
        const winner = match.winner as TournamentIdea;
        winners3.push(winner);
        setLastMatch(
          `${a.title} vs ${b.title} → ${winner.title}${match.reason ? ` (${match.reason})` : ''}`,
        );
        setPool([...winners3]);
        mark(
          'round3',
          i + 1,
          pairs3.length,
          `Round 3 complete ${i + 1}/${pairs3.length}. Winner: ${winner.title}`,
        );
        await sleep(250);
      }
      pushLog('round3', `Final 12 icons selected for drawing.`, 'ok');

      // 7) Render images → SVG one by one
      const finals: FinalIcon[] = winners3.map((idea) => ({
        id: idea.id,
        title: idea.title,
        slug: slugifyTitle(idea.title),
        look: idea.look || idea.description || idea.summary,
        summary: idea.summary,
        description: idea.description || idea.summary,
        status: 'pending',
      }));
      setFinalists(finals);
      mark('render', 0, finals.length, 'Drawing final icon 1…');
      pushLog('render', `Drawing & tracing ${finals.length} SVGs one at a time.`);

      const completed: FinalIcon[] = [];
      for (let i = 0; i < finals.length; i += 1) {
        if (abortRef.current) return;
        const icon = finals[i];
        setFinalists((prev) =>
          prev.map((f, idx) => (idx === i ? { ...f, status: 'drawing', error: null } : f)),
        );
        mark('render', i, finals.length, `Drawing SVG ${i + 1}/${finals.length}: ${icon.title}`);
        try {
          const prompt = buildIconProductionBrief({
            category: topic,
            title: icon.title,
            summary: icon.summary,
            description: icon.description,
            look: icon.look,
          });
          const res = await fetch('/api/icon/generate', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              prompt,
              name: icon.title,
              slug: icon.slug,
              style: 'filled',
              size: 512,
              sessionId,
            }),
          });
          let data: Record<string, unknown> = {};
          try {
            data = await res.json();
          } catch {
            throw new Error(`SVG render returned non-JSON (HTTP ${res.status}).`);
          }
          if (!res.ok) {
            throw new Error(
              typeof data.error === 'string'
                ? data.error
                : `SVG render failed (HTTP ${res.status}).`,
            );
          }
          const ready: FinalIcon = {
            ...icon,
            id: typeof data.id === 'string' ? data.id : icon.id,
            svg: typeof data.svg === 'string' ? data.svg : null,
            pngBase64: typeof data.pngBase64 === 'string' ? data.pngBase64 : null,
            status: 'ready',
          };
          completed.push(ready);
          setFinalists((prev) => prev.map((f, idx) => (idx === i ? ready : f)));
          mark('render', i + 1, finals.length, `SVG ready ${i + 1}/${finals.length}: ${icon.title}`);
          pushLog('render', `Rendered ${icon.slug}.svg`, 'ok');
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Render failed';
          const failed: FinalIcon = { ...icon, status: 'failed', error: message };
          completed.push(failed);
          setFinalists((prev) => prev.map((f, idx) => (idx === i ? failed : f)));
          pushLog('render', `Failed ${icon.title}: ${message}`, 'error');
          mark('render', i + 1, finals.length, `Failed ${i + 1}/${finals.length}: ${icon.title}`);
        }
        await sleep(800);
      }

      const readyIcons = completed.filter((c) => c.status === 'ready');
      const setId = crypto.randomUUID();
      const saved = {
        id: setId,
        category: topic,
        createdAt: new Date().toISOString(),
        icons: completed,
      };
      setSavedSets((prev) => {
        const next = [saved, ...prev].slice(0, 30);
        try {
          window.localStorage.setItem(SETS_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });

      mark(
        'done',
        readyIcons.length,
        completed.length,
        `Done. ${readyIcons.length}/${completed.length} tournament icons ready.`,
      );
      pushLog(
        'done',
        `Tournament complete for “${topic}”: ${readyIcons.length} SVGs ready.`,
        'ok',
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Tournament failed';
      const stageName =
        err && typeof err === 'object' && 'stage' in err && typeof (err as { stage?: string }).stage === 'string'
          ? (err as { stage: string }).stage
          : stage;
      setStage('error');
      setError(message);
      setErrorStage(stageName);
      setStatusText(`Stopped during “${stageName}”.`);
      pushLog(stageName, message, 'error');
    } finally {
      setRunning(false);
    }
  }

  async function applyChange(icon: FinalIcon) {
    const request = changeText.trim();
    if (!request || running) return;
    setError(null);
    setFinalists((prev) =>
      prev.map((f) => (f.id === icon.id ? { ...f, status: 'changing', error: null } : f)),
    );
    try {
      const prompt = buildIconProductionBrief({
        category: category.trim() || 'general',
        title: icon.title,
        summary: icon.summary,
        description: icon.description,
        look: icon.look,
      });
      const res = await fetch('/api/icon/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          prompt,
          name: icon.title,
          slug: icon.slug,
          style: 'filled',
          size: 512,
          sessionId,
          changeRequest: request,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : `Remake failed (HTTP ${res.status})`);
      }
      const updated: FinalIcon = {
        ...icon,
        svg: typeof data.svg === 'string' ? data.svg : icon.svg,
        pngBase64: typeof data.pngBase64 === 'string' ? data.pngBase64 : icon.pngBase64,
        look: `${icon.look} (revised: ${request})`,
        status: 'ready',
        error: null,
      };
      setFinalists((prev) => {
        const next = prev.map((f) => (f.id === icon.id ? updated : f));
        setSavedSets((sets) => {
          const synced = sets.map((set) =>
            set.category === category.trim()
              ? { ...set, icons: set.icons.map((f) => (f.id === icon.id ? updated : f)) }
              : set,
          );
          try {
            window.localStorage.setItem(SETS_KEY, JSON.stringify(synced));
          } catch {
            // ignore
          }
          return synced;
        });
        return next;
      });
      setChangingId(null);
      setChangeText('');
      pushLog('change', `Remade ${icon.title}: ${request}`, 'ok');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Remake failed';
      setFinalists((prev) =>
        prev.map((f) => (f.id === icon.id ? { ...f, status: 'failed', error: message } : f)),
      );
      setError(message);
      pushLog('change', message, 'error');
    }
  }

  async function downloadZip() {
    const ready = finalists.filter((f) => f.svg);
    if (!ready.length) return;
    try {
      const res = await fetch('/api/icon/collection/zip', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          category: category.trim() || 'tournament-set',
          icons: ready.map((icon) => ({
            name: icon.title,
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
      downloadBlob(`${slugifyTitle(category || 'icons')}-tournament.zip`, blob);
      pushLog('done', `Downloaded ZIP with ${ready.length} icons.`, 'ok');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'ZIP download failed';
      setError(message);
      setErrorStage('zip');
      pushLog('zip', message, 'error');
    }
  }

  function openSavedSet(set: { category: string; icons: FinalIcon[] }) {
    setCategory(set.category);
    setFinalists(set.icons);
    setStage('done');
    setStatusText(`Loaded saved set “${set.category}”.`);
    setPool([]);
  }

  const progressPct =
    stageTotal > 0 ? Math.min(100, Math.round((stageProgress / stageTotal) * 100)) : stage === 'done' ? 100 : 0;

  return (
    <div className="icon-shell">
      <header className="icon-top">
        <Link href="/" className="icon-brand-link">
          AiWebDesignFirm
        </Link>
      </header>

      <section className="icon-hero">
        <p className="icon-kicker">Icon tournament</p>
        <h1 className="icon-title">Icon</h1>
        <p className="icon-lede">
          Enter a category. We decide what it must communicate as an agency, which icons carry those ideas,
          how to make each mark simple and beautiful, lock exact details, then draw twelve 512×512 SVGs.
          Use <strong>Change</strong> on any finished icon to remake it with your notes.
        </p>

        <form className="icon-form" onSubmit={runTournament}>
          <label className="icon-label" htmlFor={`${formId}-category`}>
            Business category
          </label>
          <input
            id={`${formId}-category`}
            className="icon-prompt icon-prompt-single"
            maxLength={100}
            placeholder="e.g. baseball training academy"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            disabled={running}
          />
          <p className="icon-hint">
            Slow &amp; steady: every Claude / image call waits for the previous one to finish. Expect roughly 10–20
            minutes.
          </p>
          <button className="icon-generate" type="submit" disabled={running || !category.trim()}>
            {running ? 'Tournament running…' : 'Start icon tournament'}
          </button>
        </form>
      </section>

      <section className="icon-library">
        <div className="icon-stage-head">
          <div>
            <h2>Live progress</h2>
            <p className="icon-library-meta">
              {stageMeta ? stageMeta.label : 'Idle'}
              {running ? ` · ETA ${formatEta(etaSeconds)}` : ''}
            </p>
          </div>
        </div>

        <div className="icon-progress-panel">
          <p className="icon-status-line">{statusText}</p>
          {agencyBrief ? <p className="icon-strategy-brief">{agencyBrief}</p> : null}
          {stageMeta && stage !== 'idle' ? <p className="icon-hint">{stageMeta.detail}</p> : null}
          <div className="icon-progress-bar" aria-hidden>
            <span style={{ width: `${progressPct}%` }} />
          </div>
          <p className="icon-library-meta">
            Step {stageProgress}/{stageTotal || '—'} · {progressPct}%
            {running ? ` · estimated time remaining ${formatEta(etaSeconds)}` : ''}
          </p>
          {lastMatch ? <p className="icon-match-line">Latest match: {lastMatch}</p> : null}
          {error ? (
            <div className="icon-error-box">
              <strong>Error{errorStage ? ` during “${errorStage}”` : ''}</strong>
              <p>{error}</p>
              <p className="icon-hint">
                Fix the issue (API key, rate limit, network), then start the tournament again. No overlapping API
                calls are used.
              </p>
            </div>
          ) : null}
        </div>

        <ol className="icon-stage-list">
          {TOURNAMENT_STAGES.filter((s) => s.id !== 'idle' && s.id !== 'error').map((s) => {
            const active = s.id === stage;
            const doneIdx = TOURNAMENT_STAGES.findIndex((x) => x.id === stage);
            const thisIdx = TOURNAMENT_STAGES.findIndex((x) => x.id === s.id);
            const complete = stage === 'done' || (doneIdx > thisIdx && stage !== 'error');
            return (
              <li key={s.id} className={active ? 'is-active' : complete ? 'is-complete' : ''}>
                <strong>{s.label}</strong>
                <span>{s.detail}</span>
              </li>
            );
          })}
        </ol>

        {logs.length ? (
          <div className="icon-log">
            <h3>Activity log</h3>
            <ul>
              {logs.map((line) => (
                <li key={line.id} className={`tone-${line.tone || 'info'}`}>
                  <code>{line.stage}</code> {line.text}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {pool.length > 0 && stage !== 'done' && stage !== 'render' ? (
          <div className="icon-pool">
            <h3>Current pool ({pool.length})</h3>
            <div className="icon-pool-grid">
              {pool.slice(0, 48).map((idea) => (
                <div key={idea.id} className="icon-pool-card">
                  <strong>{idea.title}</strong>
                  <span>{idea.look || idea.description || idea.summary}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {finalists.length > 0 ? (
        <section className="icon-set-stage">
          <div className="icon-stage-head">
            <div>
              <h2>Final tournament set</h2>
              <p className="icon-library-meta">
                {finalists.filter((f) => f.status === 'ready').length}/{finalists.length} SVGs ready
              </p>
              {agencyBrief ? <p className="icon-strategy-brief">{agencyBrief}</p> : null}
            </div>
            <button
              type="button"
              className="icon-download-primary"
              onClick={() => void downloadZip()}
              disabled={!finalists.some((f) => f.svg)}
            >
              Download ZIP
            </button>
          </div>
          <div className="icon-set-grid">
            {finalists.map((icon) => (
              <article key={icon.id} className={`icon-set-card is-${icon.status}`}>
                <div className="icon-set-art">
                  {icon.status === 'ready' ? (
                    <IconPreview svg={icon.svg} pngBase64={icon.pngBase64} alt={icon.title} />
                  ) : icon.status === 'drawing' || icon.status === 'pending' || icon.status === 'changing' ? (
                    <div className="icon-loading compact">
                      <span className="icon-pulse" />
                      <p>
                        {icon.status === 'changing'
                          ? 'Updating…'
                          : icon.status === 'drawing'
                            ? 'Drawing…'
                            : 'Queued…'}
                      </p>
                    </div>
                  ) : (
                    <p className="icon-empty">Failed</p>
                  )}
                </div>
                <div className="icon-set-meta">
                  <h3>{icon.title}</h3>
                  <p>{icon.summary || icon.description || icon.look}</p>
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
                      disabled={running}
                      onClick={() => {
                        setChangingId(icon.id);
                        setChangeText('');
                      }}
                    >
                      Change
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
                      disabled={running || icon.status === 'changing'}
                    />
                    <div className="icon-set-actions">
                      <button
                        type="button"
                        className="icon-download-primary"
                        disabled={running || icon.status === 'changing' || !changeText.trim()}
                        onClick={() => void applyChange(icon)}
                      >
                        Remake icon
                      </button>
                      <button
                        type="button"
                        className="icon-download-secondary"
                        disabled={running || icon.status === 'changing'}
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
          <h2>Saved tournament sets</h2>
          <p className="icon-library-meta">
            {savedSets.length ? `${savedSets.length} saved in this browser` : 'Completed sets appear here'}
          </p>
        </div>
        {savedSets.length ? (
          <div className="icon-past-grid">
            {savedSets.map((set) => (
              <button
                key={set.id}
                type="button"
                className="icon-past-item"
                onClick={() => openSavedSet(set)}
                disabled={running}
              >
                <strong>{set.category}</strong>
                <span>
                  {set.icons.filter((i) => i.status === 'ready').length}/{set.icons.length} ready
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="icon-empty">No saved tournament sets yet.</p>
        )}
      </section>
    </div>
  );
}
