'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

type Mode = 'all' | 'standard' | 'limited' | 'tft';

type Entry = {
  rank: number;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  wins: number;
  losses: number;
  draws: number;
  winRate: number | null;
  lastPlayedAt: string | null;
};

const MODES: Array<{ id: Mode; label: string }> = [
  { id: 'all', label: 'Overall' },
  { id: 'standard', label: 'Live Battle' },
  { id: 'limited', label: 'Draft Battle' },
  { id: 'tft', label: 'TFT' },
];

export default function LeaderboardClient() {
  const [mode, setMode] = useState<Mode>('all');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const load = useCallback(async (nextMode: Mode) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tdg-pvp/leaderboard?mode=${nextMode}&limit=50`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setEntries(data.entries || []);
      setUpdatedAt(data.updatedAt || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(mode);
  }, [mode, load]);

  return (
    <main className="min-h-[100dvh] bg-[#0a0a0f] text-[#f5f5f7]">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 50% -10%, rgba(201,162,39,0.2), transparent 45%), radial-gradient(ellipse at 0% 40%, rgba(30,90,80,0.2), transparent 40%)',
        }}
      />
      <div className="relative mx-auto max-w-3xl px-5 py-16">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-amber-300/80">Territory Game</p>
            <h1 className="mt-2 font-[family-name:var(--font-heading)] text-3xl font-semibold tracking-tight">
              Leaderboard
            </h1>
            <p className="mt-2 max-w-lg text-sm text-white/60">
              Rankings for Google-linked accounts. Play online with your account display name so wins count.
            </p>
          </div>
          <div className="flex gap-3 text-sm">
            <Link href="/account" className="text-teal-200/90 hover:text-teal-100">
              Account
            </Link>
            <Link href="/TDG" className="text-white/70 hover:text-white">
              Play
            </Link>
            <Link href="/activity" className="text-white/50 hover:text-white/80">
              Live activity
            </Link>
          </div>
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              className={`rounded-lg px-3 py-1.5 text-sm transition ${
                mode === m.id
                  ? 'bg-amber-300 text-[#1a1208] font-semibold'
                  : 'border border-white/15 text-white/70 hover:border-white/30 hover:text-white'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
          <div className="grid grid-cols-[48px_1fr_72px_72px_72px] gap-2 border-b border-white/10 px-4 py-3 text-xs uppercase tracking-[0.12em] text-white/40">
            <span>#</span>
            <span>Player</span>
            <span className="text-right">Wins</span>
            <span className="text-right">Losses</span>
            <span className="text-right">Rate</span>
          </div>

          {loading ? (
            <p className="px-4 py-8 text-white/50">Loading rankings…</p>
          ) : error ? (
            <p className="px-4 py-8 text-red-300">{error}</p>
          ) : entries.length === 0 ? (
            <div className="space-y-3 px-4 py-10 text-center">
              <p className="text-white/60">No ranked games yet.</p>
              <p className="text-sm text-white/40">
                <Link href="/account" className="text-teal-300 hover:text-teal-200">
                  Sign in with Google
                </Link>
                , set your display name, then win online matches in TDG.
              </p>
            </div>
          ) : (
            <ul>
              {entries.map((entry) => (
                <li
                  key={`${entry.userId}-${entry.rank}`}
                  className="grid grid-cols-[48px_1fr_72px_72px_72px] items-center gap-2 border-b border-white/5 px-4 py-3 last:border-b-0"
                >
                  <span className="font-[family-name:var(--font-heading)] text-amber-200/90">
                    {entry.rank}
                  </span>
                  <div className="flex min-w-0 items-center gap-3">
                    {entry.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={entry.avatarUrl}
                        alt=""
                        className="h-8 w-8 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs">
                        {entry.displayName.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <span className="truncate font-medium">{entry.displayName}</span>
                  </div>
                  <span className="text-right tabular-nums text-teal-200">{entry.wins}</span>
                  <span className="text-right tabular-nums text-white/55">{entry.losses}</span>
                  <span className="text-right tabular-nums text-white/70">
                    {entry.winRate != null ? `${entry.winRate}%` : '—'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {updatedAt && (
          <p className="mt-4 text-xs text-white/35">
            Updated {new Date(updatedAt).toLocaleString()}
          </p>
        )}
      </div>
    </main>
  );
}
