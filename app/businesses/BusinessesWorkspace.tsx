'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'adf_businesses_workspace_v1';

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

function newId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export default function BusinessesWorkspace() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newBusinessName, setNewBusinessName] = useState('');
  const [showAddInput, setShowAddInput] = useState(false);
  const [roadmapDraft, setRoadmapDraft] = useState('');
  const [noteDraft, setNoteDraft] = useState('');

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Business[];
        if (Array.isArray(parsed)) setBusinesses(parsed);
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(businesses));
    } catch {
      /* ignore */
    }
  }, [businesses, hydrated]);

  const selected = useMemo(
    () => businesses.find((b) => b.id === selectedId) ?? null,
    [businesses, selectedId],
  );

  const updateBusiness = useCallback((id: string, fn: (b: Business) => Business) => {
    setBusinesses((prev) => prev.map((b) => (b.id === id ? fn(b) : b)));
  }, []);

  function addBusiness() {
    const name = newBusinessName.trim();
    if (!name) return;
    const b: Business = {
      id: newId(),
      name,
      createdAt: new Date().toISOString(),
      roadmap: [],
      notes: [],
    };
    setBusinesses((prev) => [...prev, b]);
    setSelectedId(b.id);
    setNewBusinessName('');
    setShowAddInput(false);
  }

  function removeBusiness(id: string) {
    setBusinesses((prev) => prev.filter((b) => b.id !== id));
    setSelectedId((cur) => (cur === id ? null : cur));
  }

  function addRoadmapStep() {
    if (!selected) return;
    const title = roadmapDraft.trim();
    if (!title) return;
    const step: RoadmapStep = { id: newId(), title, done: false };
    updateBusiness(selected.id, (b) => ({ ...b, roadmap: [...b.roadmap, step] }));
    setRoadmapDraft('');
  }

  function toggleStep(stepId: string) {
    if (!selected) return;
    updateBusiness(selected.id, (b) => ({
      ...b,
      roadmap: b.roadmap.map((s) => (s.id === stepId ? { ...s, done: !s.done } : s)),
    }));
  }

  function removeStep(stepId: string) {
    if (!selected) return;
    updateBusiness(selected.id, (b) => ({
      ...b,
      roadmap: b.roadmap.filter((s) => s.id !== stepId),
    }));
  }

  function addNote() {
    if (!selected) return;
    const body = noteDraft.trim();
    if (!body) return;
    const note: NoteEntry = { id: newId(), body, createdAt: new Date().toISOString() };
    updateBusiness(selected.id, (b) => ({ ...b, notes: [note, ...b.notes] }));
    setNoteDraft('');
  }

  function removeNote(noteId: string) {
    if (!selected) return;
    updateBusiness(selected.id, (b) => ({ ...b, notes: b.notes.filter((n) => n.id !== noteId) }));
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
                  if (e.key === 'Enter') addBusiness();
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
                  onClick={addBusiness}
                  disabled={!newBusinessName.trim()}
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
            {businesses.length === 0 ? (
              <li className="px-3 py-8 text-center text-sm text-gray-500">No businesses yet. Tap + to add one.</li>
            ) : (
              businesses.map((b) => (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(b.id)}
                    className={cn(
                      'flex w-full items-center justify-between gap-2 border-b border-white/5 px-3 py-3 text-left text-sm font-medium transition-colors',
                      selectedId === b.id
                        ? 'bg-[#0066ff]/20 text-white'
                        : 'text-gray-300 hover:bg-white/[0.04] hover:text-white',
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
                  <p className="mt-1 text-xs text-gray-500">Stored in this browser only (local).</p>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="shrink-0 text-gray-500 hover:bg-red-500/10 hover:text-red-400"
                  aria-label={`Delete ${selected.name}`}
                  onClick={() => removeBusiness(selected.id)}
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
                        className="flex items-start gap-3 rounded-lg border border-white/10 bg-[#0c1220] px-3 py-2.5"
                      >
                        <button
                          type="button"
                          onClick={() => toggleStep(s.id)}
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
                          onClick={() => removeStep(s.id)}
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
                      onKeyDown={(e) => e.key === 'Enter' && addRoadmapStep()}
                      placeholder="Next step on the roadmap…"
                      className="border-white/15 bg-black/40 text-sm text-white placeholder:text-gray-500"
                    />
                  </div>
                  <Button
                    type="button"
                    className="shrink-0 bg-gradient-to-r from-[#0066ff] to-[#00d4ff] text-black hover:opacity-95 sm:w-auto"
                    onClick={addRoadmapStep}
                    disabled={!roadmapDraft.trim()}
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
                      className="border-white/15 bg-black/40 text-sm text-white placeholder:text-gray-500"
                    />
                    <Button
                      type="button"
                      className="mt-2 bg-white/10 text-white hover:bg-white/15"
                      onClick={addNote}
                      disabled={!noteDraft.trim()}
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
                              onClick={() => removeNote(n.id)}
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
