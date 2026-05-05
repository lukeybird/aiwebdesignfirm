'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, GripVertical, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

type RoadmapStep = {
  id: string;
  title: string;
  done: boolean;
};

type NoteEntry = {
  id: string;
  body: string;
  createdAt: string;
};

type Business = {
  id: string;
  name: string;
  createdAt: string;
  roadmap: RoadmapStep[];
  notes: NoteEntry[];
};

async function parseJsonError(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: string };
    return j.error || res.statusText;
  } catch {
    return res.statusText;
  }
}

export default function BusinessesWorkspace() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newBusinessName, setNewBusinessName] = useState('');
  const [showAddInput, setShowAddInput] = useState(false);
  const [roadmapDraft, setRoadmapDraft] = useState('');
  const [noteDraft, setNoteDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [draggingStepId, setDraggingStepId] = useState<string | null>(null);
  const [dragOverStepId, setDragOverStepId] = useState<string | null>(null);

  const refreshBusinesses = useCallback(async () => {
    const res = await fetch('/api/business-ideas');
    const j = (await res.json()) as { businesses?: Business[]; error?: string };
    if (!res.ok) {
      throw new Error(j.error || (await parseJsonError(res)));
    }
    const list = Array.isArray(j.businesses) ? j.businesses : [];
    setBusinesses(list);
    setSelectedId((cur) => (cur && list.some((b) => b.id === cur) ? cur : null));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        await refreshBusinesses();
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load businesses');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshBusinesses]);

  const selected = useMemo(
    () => businesses.find((b) => b.id === selectedId) ?? null,
    [businesses, selectedId],
  );

  async function addBusiness() {
    const name = newBusinessName.trim();
    if (!name || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/business-ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const j = (await res.json()) as { business?: Business; error?: string };
      if (!res.ok) throw new Error(j.error || (await parseJsonError(res)));
      await refreshBusinesses();
      if (j.business?.id) setSelectedId(j.business.id);
      setNewBusinessName('');
      setShowAddInput(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add business');
    } finally {
      setBusy(false);
    }
  }

  async function removeBusiness(id: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/business-ideas/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await parseJsonError(res));
      setSelectedId((cur) => (cur === id ? null : cur));
      await refreshBusinesses();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete business');
    } finally {
      setBusy(false);
    }
  }

  async function addRoadmapStep() {
    if (!selected || busy) return;
    const title = roadmapDraft.trim();
    if (!title) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/business-ideas/${selected.id}/roadmap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) throw new Error(await parseJsonError(res));
      setRoadmapDraft('');
      await refreshBusinesses();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add step');
    } finally {
      setBusy(false);
    }
  }

  async function reorderSteps(draggedStepId: string, targetStepId: string) {
    if (!selected || busy || draggedStepId === targetStepId) return;
    const steps = selected.roadmap;
    const fromIndex = steps.findIndex((s) => s.id === draggedStepId);
    const toIndex = steps.findIndex((s) => s.id === targetStepId);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;

    const reordered = [...steps];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);

    // Optimistic reorder for immediate feedback.
    setBusinesses((prev) =>
      prev.map((b) => (b.id === selected.id ? { ...b, roadmap: reordered } : b)),
    );

    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/business-ideas/${selected.id}/roadmap`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedStepIds: reordered.map((s) => s.id) }),
      });
      if (!res.ok) throw new Error(await parseJsonError(res));
      await refreshBusinesses();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reorder steps');
      await refreshBusinesses();
    } finally {
      setBusy(false);
      setDraggingStepId(null);
      setDragOverStepId(null);
    }
  }

  async function toggleStep(stepId: string, currentDone: boolean) {
    if (!selected || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/business-ideas/${selected.id}/roadmap`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stepId, done: !currentDone }),
      });
      if (!res.ok) throw new Error(await parseJsonError(res));
      await refreshBusinesses();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update step');
    } finally {
      setBusy(false);
    }
  }

  async function removeStep(stepId: string) {
    if (!selected || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/business-ideas/${selected.id}/roadmap?stepId=${encodeURIComponent(stepId)}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error(await parseJsonError(res));
      await refreshBusinesses();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove step');
    } finally {
      setBusy(false);
    }
  }

  async function addNote() {
    if (!selected || busy) return;
    const body = noteDraft.trim();
    if (!body) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/business-ideas/${selected.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      if (!res.ok) throw new Error(await parseJsonError(res));
      setNoteDraft('');
      await refreshBusinesses();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add note');
    } finally {
      setBusy(false);
    }
  }

  async function removeNote(noteId: string) {
    if (!selected || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/business-ideas/${selected.id}/notes?noteId=${encodeURIComponent(noteId)}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error(await parseJsonError(res));
      await refreshBusinesses();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete note');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#0a0a0f] text-[#e8eef8]">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/developer/dashboard"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-medium text-cyan-200/90 transition-colors hover:bg-white/5 hover:text-white sm:text-sm"
          >
            <ArrowLeft className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Admin
          </Link>
          <h1 className="truncate text-base font-bold text-white sm:text-lg">Business ideas</h1>
        </div>
      </header>

      {error ? (
        <div className="border-b border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-200">
          {error}
          <button
            type="button"
            className="ml-3 underline hover:text-white"
            onClick={() => setError(null)}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {/* Left: list */}
        <aside className="flex w-full shrink-0 flex-col border-b border-white/10 bg-[#070b12] md:w-72 md:border-b-0 md:border-r">
          <div className="flex items-center justify-between gap-2 border-b border-white/5 px-3 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Your list</span>
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-8 w-8 shrink-0 border-[#0066ff]/40 bg-[#0066ff]/10 text-cyan-100 hover:bg-[#0066ff]/20"
              aria-label="Add business"
              disabled={loading || busy}
              onClick={() => {
                setShowAddInput(true);
                setTimeout(() => {
                  const el = document.getElementById('new-business-name');
                  el?.focus();
                }, 0);
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {showAddInput ? (
            <div className="border-b border-white/5 p-3">
              <label htmlFor="new-business-name" className="sr-only">
                New business name
              </label>
              <Input
                id="new-business-name"
                value={newBusinessName}
                onChange={(e) => setNewBusinessName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void addBusiness();
                  if (e.key === 'Escape') {
                    setShowAddInput(false);
                    setNewBusinessName('');
                  }
                }}
                placeholder="Business name…"
                className="border-white/15 bg-black/40 text-sm text-white placeholder:text-gray-500"
              />
              <div className="mt-2 flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="bg-gradient-to-r from-[#0066ff] to-[#00d4ff] text-black hover:opacity-95"
                  onClick={() => void addBusiness()}
                  disabled={!newBusinessName.trim() || busy}
                >
                  Add
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-gray-400 hover:bg-white/5 hover:text-white"
                  onClick={() => {
                    setShowAddInput(false);
                    setNewBusinessName('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}

          <ul className="max-h-[40vh] overflow-y-auto md:max-h-none md:flex-1">
            {loading ? (
              <li className="px-3 py-8 text-center text-sm text-gray-500">Loading…</li>
            ) : businesses.length === 0 ? (
              <li className="px-3 py-8 text-center text-sm text-gray-500">No businesses yet. Tap + to add one.</li>
            ) : (
              businesses.map((b) => (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(b.id)}
                    disabled={busy}
                    className={cn(
                      'flex w-full items-center justify-between gap-2 border-b border-white/5 px-3 py-3 text-left text-sm font-medium transition-colors',
                      selectedId === b.id
                        ? 'bg-[#0066ff]/20 text-white'
                        : 'text-gray-300 hover:bg-white/[0.04] hover:text-white',
                      busy && 'opacity-60',
                    )}
                  >
                    <span className="min-w-0 truncate">{b.name}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </aside>

        {/* Right: detail */}
        <section className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {!selected ? (
            <div className="mx-auto flex max-w-md flex-col items-center justify-center py-16 text-center">
              <p className="text-lg font-medium text-white">Choose a business</p>
              <p className="mt-2 text-sm text-gray-500">
                Pick an idea from the list, or use the + button to add a new one. Then you can plan roadmap steps and
                notes here.
              </p>
            </div>
          ) : (
            <div className="mx-auto max-w-2xl space-y-10">
              <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
                <div className="min-w-0">
                  <h2 className="text-2xl font-bold tracking-tight text-white">{selected.name}</h2>
                  <p className="mt-1 text-xs text-gray-500">Saved in your Postgres database (same as the rest of the app).</p>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="shrink-0 text-gray-500 hover:bg-red-500/10 hover:text-red-400"
                  aria-label={`Delete ${selected.name}`}
                  disabled={busy}
                  onClick={() => void removeBusiness(selected.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div>
                <h3 className="text-sm font-bold uppercase tracking-wide text-cyan-200/80">Roadmap — next steps</h3>
                <p className="mt-1 text-xs text-gray-500">Add steps in order; check them off as you go.</p>
                <ul className="mt-4 space-y-2">
                  {selected.roadmap.length === 0 ? (
                    <li className="rounded-lg border border-dashed border-white/10 py-6 text-center text-sm text-gray-500">
                      No steps yet. Add the first one below.
                    </li>
                  ) : (
                    selected.roadmap.map((s) => (
                      <li
                        key={s.id}
                        draggable={!busy}
                        onDragStart={() => {
                          setDraggingStepId(s.id);
                          setDragOverStepId(s.id);
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          if (dragOverStepId !== s.id) setDragOverStepId(s.id);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const dragged = draggingStepId;
                          if (dragged) void reorderSteps(dragged, s.id);
                        }}
                        onDragEnd={() => {
                          setDraggingStepId(null);
                          setDragOverStepId(null);
                        }}
                        className={cn(
                          'flex items-start gap-3 rounded-lg border bg-[#0c1220] px-3 py-2.5 transition-colors',
                          dragOverStepId === s.id && draggingStepId !== s.id
                            ? 'border-cyan-300/70 bg-cyan-500/10'
                            : 'border-white/10',
                        )}
                      >
                        <button
                          type="button"
                          disabled={busy}
                          className="mt-0.5 shrink-0 cursor-grab rounded p-1 text-gray-500 hover:bg-white/5 hover:text-cyan-200 active:cursor-grabbing"
                          aria-label="Drag to reorder"
                        >
                          <GripVertical className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void toggleStep(s.id, s.done)}
                          className={cn(
                            'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border',
                            s.done
                              ? 'border-cyan-400/50 bg-cyan-500/20 text-cyan-100'
                              : 'border-white/20 bg-black/30 text-gray-600',
                          )}
                          aria-label={s.done ? 'Mark not done' : 'Mark done'}
                        >
                          {s.done ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                        </button>
                        <span className={cn('min-w-0 flex-1 text-sm leading-snug', s.done && 'text-gray-500 line-through')}>
                          {s.title}
                        </span>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void removeStep(s.id)}
                          className="shrink-0 rounded p-1 text-gray-600 hover:bg-white/5 hover:text-red-400"
                          aria-label="Remove step"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))
                  )}
                </ul>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
                  <div className="min-w-0 flex-1">
                    <label htmlFor="roadmap-draft" className="sr-only">
                      Next step
                    </label>
                    <Input
                      id="roadmap-draft"
                      value={roadmapDraft}
                      onChange={(e) => setRoadmapDraft(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && void addRoadmapStep()}
                      placeholder="Next step on the roadmap…"
                      disabled={busy}
                      className="border-white/15 bg-black/40 text-sm text-white placeholder:text-gray-500"
                    />
                  </div>
                  <Button
                    type="button"
                    className="shrink-0 bg-gradient-to-r from-[#0066ff] to-[#00d4ff] text-black hover:opacity-95 sm:w-auto"
                    onClick={() => void addRoadmapStep()}
                    disabled={!roadmapDraft.trim() || busy}
                  >
                    Add step
                  </Button>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold uppercase tracking-wide text-cyan-200/80">Notes</h3>
                <p className="mt-1 text-xs text-gray-500">Individual notes for this idea (newest first).</p>
                <div className="mt-4 space-y-3">
                  <div>
                    <label htmlFor="note-draft" className="sr-only">
                      New note
                    </label>
                    <Textarea
                      id="note-draft"
                      value={noteDraft}
                      onChange={(e) => setNoteDraft(e.target.value)}
                      placeholder="Write a note…"
                      rows={3}
                      disabled={busy}
                      className="border-white/15 bg-black/40 text-sm text-white placeholder:text-gray-500"
                    />
                    <Button
                      type="button"
                      className="mt-2 bg-white/10 text-white hover:bg-white/15"
                      onClick={() => void addNote()}
                      disabled={!noteDraft.trim() || busy}
                    >
                      Add note
                    </Button>
                  </div>
                  {selected.notes.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-white/10 py-6 text-center text-sm text-gray-500">
                      No notes yet.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {selected.notes.map((n) => (
                        <li
                          key={n.id}
                          className="rounded-lg border border-white/10 bg-[#0c1220] p-3 text-sm leading-relaxed text-gray-200"
                        >
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <time className="text-[11px] text-gray-500" dateTime={n.createdAt}>
                              {new Date(n.createdAt).toLocaleString(undefined, {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              })}
                            </time>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void removeNote(n.id)}
                              className="rounded p-1 text-gray-600 hover:bg-white/5 hover:text-red-400"
                              aria-label="Delete note"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <p className="whitespace-pre-wrap">{n.body}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
