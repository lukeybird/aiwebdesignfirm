'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Activity, RefreshCw, Swords, Trophy, Users, Radio, Map as MapIcon, History } from 'lucide-react';
import dynamic from 'next/dynamic';

const PresenceMap = dynamic(() => import('@/components/presence/PresenceMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[min(62vh,560px)] items-center justify-center rounded-2xl border border-white/10 bg-[#0b1220] text-sm text-white/50">
      Loading live map…
    </div>
  ),
});

type PlayerStats = {
  wins: number;
  losses: number;
  draws: number;
  winRate: number | null;
  lastPlayedAt: string | null;
};

type OnlineVisitor = {
  visitorId: string;
  displayName: string;
  signedIn: boolean;
  screen: string;
  ipAddress?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  accuracyM?: number | null;
  preciseLocation?: string | null;
  geoSource?: 'gps' | 'ip' | null;
  mapsUrl?: string | null;
  lastSeenAt: string;
  firstSeenAt: string;
};

type PresenceHistoryEntry = {
  id: number;
  visitorId: string;
  displayName: string;
  signedIn: boolean;
  screen: string;
  ipAddress: string | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracyM: number | null;
  preciseLocation: string | null;
  geoSource: 'gps' | 'ip' | null;
  mapsUrl: string | null;
  eventType: string;
  recordedAt: string;
};

type ActivityData = {
  queue: Array<{ playerName: string; waitingSince: string; lastSeenAt: string }>;
  activeMatches: Array<{
    roomId: string;
    player0Name: string;
    player1Name: string;
    startedAt: string;
  }>;
  recentMatches: Array<{
    roomId: string;
    player0Name: string;
    player1Name: string;
    winnerSlot: number | null;
    winnerName: string | null;
    loserName: string | null;
    endReason: string | null;
    startedAt: string;
    endedAt: string | null;
  }>;
  players: Record<string, PlayerStats>;
  onlineNow?: OnlineVisitor[];
  onlineCount?: number;
  presenceHistory?: PresenceHistoryEntry[];
  presenceHistorySummary?: {
    events: number;
    visitors: number;
    gpsEvents: number;
    mappedEvents: number;
    hours: number;
  };
  updatedAt: string;
  profile?: PlayerProfile;
};

type PlayerProfile = {
  playerName: string;
  wins: number;
  losses: number;
  draws: number;
  winRate: number | null;
  record: string;
  lastPlayedAt: string | null;
  recentMatches: Array<{
    roomId: string;
    opponent: string;
    result: 'win' | 'loss' | 'draw';
    endReason: string | null;
    endedAt: string | null;
  }>;
};

function formatTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatReason(reason: string | null) {
  switch (reason) {
    case 'base_destroyed':
      return 'Base destroyed';
    case 'forfeit':
      return 'Forfeit';
    case 'disconnect':
      return 'Disconnect';
    case 'draw':
      return 'Draw';
    case 'timeout':
      return 'Timed out';
    case 'admin_cancel':
      return 'Admin cancelled';
    default:
      return reason || 'Unknown';
  }
}

function formatScreen(screen: string) {
  switch (screen) {
    case 'menu':
      return 'Main menu';
    case 'tft':
      return 'TFT';
    case 'queue':
      return 'In queue';
    case 'match':
      return 'In match';
    case 'name':
      return 'Entering name';
    case 'draft':
      return 'Draft';
    case 'survival':
      return 'Survival setup';
    case 'manual':
      return 'Manual';
    case 'rulebook':
      return 'Rule book';
    case 'playing':
      return 'In game';
    default:
      return screen || 'On /TDG';
  }
}

function recordLabel(stats: PlayerStats) {
  const base = `${stats.wins}-${stats.losses}`;
  return stats.draws > 0 ? `${base}-${stats.draws}` : base;
}

function PlayerButton({
  name,
  stats,
  selected,
  onSelect,
}: {
  name: string;
  stats?: PlayerStats;
  selected: boolean;
  onSelect: (name: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(name)}
      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-left transition-colors ${
        selected
          ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-100'
          : 'border-white/10 bg-white/5 text-[#f5f5f7] hover:border-white/20 hover:bg-white/10'
      }`}
    >
      <span className="font-medium">{name}</span>
      {stats && (
        <span className="text-xs text-white/50">
          {recordLabel(stats)}
          {stats.winRate !== null ? ` · ${stats.winRate}%` : ''}
        </span>
      )}
    </button>
  );
}

export default function ActivityMonitor() {
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);
  const [data, setData] = useState<ActivityData | null>(null);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mapMode, setMapMode] = useState<'live' | 'history'>('live');
  const [historyHours, setHistoryHours] = useState(168);
  const [historyQuery, setHistoryQuery] = useState('');
  const [history, setHistory] = useState<PresenceHistoryEntry[]>([]);
  const [historySummary, setHistorySummary] = useState<ActivityData['presenceHistorySummary'] | undefined>(undefined);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [cancellingRoomId, setCancellingRoomId] = useState<string | null>(null);

  useEffect(() => {
    const auth = localStorage.getItem('devAuth');
    const authTime = localStorage.getItem('devAuthTime');
    if (!auth || !authTime || Date.now() - parseInt(authTime, 10) > 24 * 60 * 60 * 1000) {
      localStorage.removeItem('devAuth');
      localStorage.removeItem('devAuthTime');
      router.replace('/login/developer?next=/activity');
      return;
    }
    setAuthReady(true);
  }, [router]);

  const handleUnauthorized = useCallback(() => {
    localStorage.removeItem('devAuth');
    localStorage.removeItem('devAuthTime');
    router.replace('/login/developer?next=/activity');
  }, [router]);

  const loadActivity = useCallback(async (player?: string | null, silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const url = player
        ? `/api/tdg-pvp/activity?player=${encodeURIComponent(player)}`
        : '/api/tdg-pvp/activity';
      const res = await fetch(url, { cache: 'no-store', credentials: 'include' });
      const json = (await res.json()) as ActivityData & { error?: string; loginUrl?: string };
      if (res.status === 401) {
        handleUnauthorized();
        return;
      }
      if (!res.ok) throw new Error(json.error || 'Failed to load activity');

      setData(json);
      setProfile(json.profile ?? null);
      if (json.presenceHistory) setHistory(json.presenceHistory);
      if (json.presenceHistorySummary) setHistorySummary(json.presenceHistorySummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load activity');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [handleUnauthorized]);

  const loadHistory = useCallback(async (hours = historyHours, q = historyQuery) => {
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams({
        hours: String(hours),
        limit: '400',
      });
      if (q.trim()) params.set('q', q.trim());
      const res = await fetch(`/api/tdg-pvp/presence-log?${params}`, {
        cache: 'no-store',
        credentials: 'include',
      });
      const json = await res.json();
      if (res.status === 401) {
        handleUnauthorized();
        return;
      }
      if (!res.ok) throw new Error(json.error || 'Failed to load history');
      setHistory(json.history || []);
      setHistorySummary(json.summary || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history');
    } finally {
      setHistoryLoading(false);
    }
  }, [historyHours, historyQuery, handleUnauthorized]);

  const cancelMatch = useCallback(async (roomId: string, label: string) => {
    if (cancellingRoomId) return;
    const ok = window.confirm(`Cancel this active match?\n\n${label}\n\nPlayers will be sent back to the menu.`);
    if (!ok) return;

    setCancellingRoomId(roomId);
    setError(null);
    try {
      const res = await fetch('/api/tdg-pvp/activity/cancel', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId }),
      });
      const json = (await res.json()) as { error?: string; ok?: boolean };
      if (res.status === 401) {
        handleUnauthorized();
        return;
      }
      if (!res.ok) throw new Error(json.error || 'Failed to cancel match');
      await loadActivity(selectedPlayer, true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel match');
    } finally {
      setCancellingRoomId(null);
    }
  }, [cancellingRoomId, handleUnauthorized, loadActivity, selectedPlayer]);

  useEffect(() => {
    if (!authReady) return;
    void loadActivity();
    const timer = setInterval(() => {
      void loadActivity(selectedPlayer, true);
    }, 4000);
    return () => clearInterval(timer);
  }, [authReady, loadActivity, selectedPlayer]);

  const handleSelectPlayer = (name: string) => {
    setSelectedPlayer(name);
    void loadActivity(name, true);
  };

  const clearProfile = () => {
    setSelectedPlayer(null);
    setProfile(null);
    void loadActivity(null, true);
  };

  if (!authReady) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#0a0a0f] text-[#f5f5f7]">
        <p className="text-sm text-white opacity-50">Checking developer access...</p>
      </div>
    );
  }

  const online = data?.onlineNow ?? [];
  const onlineCount = data?.onlineCount ?? online.length;
  const mapVisitors = mapMode === 'live'
    ? online
    : history.map((h) => ({
      visitorId: `${h.visitorId}-${h.id}`,
      displayName: h.displayName,
      latitude: h.latitude,
      longitude: h.longitude,
      accuracyM: h.accuracyM,
      preciseLocation: h.preciseLocation,
      location: h.location,
      geoSource: h.geoSource,
      mapsUrl: h.mapsUrl,
      screen: `${h.screen} · ${formatTime(h.recordedAt)}`,
      ipAddress: h.ipAddress,
    }));
  const summary = historySummary || data?.presenceHistorySummary;

  return (
    <div className="min-h-[100dvh] bg-[#0a0a0f] text-[#f5f5f7]">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-emerald-400">
              <Activity className="h-5 w-5" />
              <span className="text-sm font-medium uppercase tracking-wider">Territory Game</span>
            </div>
            <h1 className="font-[family-name:var(--font-heading)] text-3xl font-semibold tracking-tight sm:text-4xl">
              PvP Activity Monitor
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-white/60">
              Who is on the site now, where they were, and a recallable location history log.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void loadActivity(selectedPlayer, true)}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <Link
              href="/leaderboard"
              className="inline-flex items-center gap-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-sm text-amber-100 hover:bg-amber-400/20"
            >
              <Trophy className="h-4 w-4" />
              Leaderboard
            </Link>
            <Link
              href="/activity/accounts"
              className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-100 hover:bg-cyan-400/20"
            >
              <Users className="h-4 w-4" />
              Accounts
            </Link>
            <Link
              href="/account"
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
            >
              Account
            </Link>
            <Link
              href="/TDG"
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
            >
              <Swords className="h-4 w-4" />
              Play
            </Link>
          </div>
        </header>

        {error && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {loading && !data ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center text-white/50">
            Loading activity…
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
            <div className="space-y-6">
              <section className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.06] p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="flex items-center gap-2 text-lg font-semibold">
                    <MapIcon className="h-5 w-5 text-emerald-400" />
                    Location map
                  </h2>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setMapMode('live')}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                        mapMode === 'live'
                          ? 'bg-emerald-500/25 text-emerald-100'
                          : 'bg-white/5 text-white/50 hover:bg-white/10'
                      }`}
                    >
                      Live
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMapMode('history');
                        void loadHistory();
                      }}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                        mapMode === 'history'
                          ? 'bg-emerald-500/25 text-emerald-100'
                          : 'bg-white/5 text-white/50 hover:bg-white/10'
                      }`}
                    >
                      History
                    </button>
                    <span className="text-xs text-white/45">
                      {mapVisitors.filter((v) => v.latitude != null && v.longitude != null).length} pinned
                    </span>
                  </div>
                </div>
                <PresenceMap visitors={mapVisitors} />
                <p className="mt-3 text-xs text-white/40">
                  {mapMode === 'live'
                    ? 'Live pins update every few seconds. Green = GPS, amber = IP estimate.'
                    : 'History map shows logged sightings from the selected time range.'}
                </p>
              </section>

              <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="flex items-center gap-2 text-lg font-semibold">
                    <History className="h-5 w-5 text-sky-400" />
                    Location history log
                  </h2>
                  <span className="text-xs text-white/40">
                    {summary
                      ? `${summary.events} events · ${summary.visitors} visitors · ${summary.gpsEvents} GPS`
                      : '—'}
                  </span>
                </div>
                <div className="mb-4 flex flex-wrap gap-2">
                  {[
                    { label: '24h', hours: 24 },
                    { label: '7d', hours: 168 },
                    { label: '30d', hours: 720 },
                    { label: '90d', hours: 2160 },
                  ].map((opt) => (
                    <button
                      key={opt.hours}
                      type="button"
                      onClick={() => {
                        setHistoryHours(opt.hours);
                        void loadHistory(opt.hours, historyQuery);
                      }}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                        historyHours === opt.hours
                          ? 'bg-sky-500/25 text-sky-100'
                          : 'bg-white/5 text-white/50 hover:bg-white/10'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                  <form
                    className="flex min-w-[200px] flex-1 gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void loadHistory(historyHours, historyQuery);
                    }}
                  >
                    <input
                      value={historyQuery}
                      onChange={(e) => setHistoryQuery(e.target.value)}
                      placeholder="Search name, IP, place…"
                      className="h-8 flex-1 rounded-lg border border-white/10 bg-black/30 px-3 text-xs text-white outline-none placeholder:text-white/30 focus:border-sky-400/40"
                    />
                    <button
                      type="submit"
                      className="rounded-lg border border-white/10 bg-white/5 px-3 text-xs text-white/70 hover:bg-white/10"
                    >
                      {historyLoading ? '…' : 'Search'}
                    </button>
                  </form>
                </div>
                {history.length ? (
                  <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                    {history.map((entry) => (
                      <div
                        key={entry.id}
                        className="rounded-xl border border-white/5 bg-black/20 px-4 py-3"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium">{entry.displayName}</span>
                              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-white/45">
                                {entry.eventType}
                              </span>
                              {entry.geoSource === 'gps' ? (
                                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-200">
                                  GPS
                                </span>
                              ) : entry.geoSource === 'ip' ? (
                                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] text-amber-100/80">
                                  IP
                                </span>
                              ) : null}
                            </div>
                            <div className="font-mono text-[11px] text-white/55">
                              {entry.preciseLocation || entry.location || 'No place label'}
                            </div>
                            {entry.latitude != null && entry.longitude != null && (
                              <div className="flex flex-wrap gap-x-3 font-mono text-[11px] text-white/40">
                                <span>
                                  {entry.latitude.toFixed(5)}, {entry.longitude.toFixed(5)}
                                  {entry.accuracyM != null ? ` · ±${Math.round(entry.accuracyM)}m` : ''}
                                </span>
                                {entry.mapsUrl && (
                                  <a
                                    href={entry.mapsUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-emerald-300/80 hover:underline"
                                  >
                                    Map
                                  </a>
                                )}
                              </div>
                            )}
                            <div className="text-[11px] text-white/35">
                              {entry.screen} · IP {entry.ipAddress || '—'} · id {entry.visitorId.slice(0, 8)}…
                            </div>
                          </div>
                          <div className="text-right text-xs text-white/40">
                            {formatTime(entry.recordedAt)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-white/45">
                    No logged visits in this range yet. As people browse with location allowed, rows appear here permanently.
                  </p>
                )}
              </section>

              <section className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.06] p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="flex items-center gap-2 text-lg font-semibold">
                    <Radio className="h-5 w-5 text-emerald-400" />
                    On the site now
                  </h2>
                  <span className="rounded-full border border-emerald-400/30 bg-emerald-500/15 px-3 py-1 text-sm font-semibold text-emerald-200">
                    {onlineCount} {onlineCount === 1 ? 'person' : 'people'}
                  </span>
                </div>
                {online.length ? (
                  <div className="space-y-2">
                    {online.map((visitor) => (
                      <div
                        key={visitor.visitorId}
                        className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-white/10 bg-black/25 px-4 py-3"
                      >
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            {data?.players?.[visitor.displayName] ? (
                              <PlayerButton
                                name={visitor.displayName}
                                stats={data.players[visitor.displayName]}
                                selected={selectedPlayer === visitor.displayName}
                                onSelect={handleSelectPlayer}
                              />
                            ) : (
                              <span className="font-medium">{visitor.displayName}</span>
                            )}
                            {visitor.signedIn ? (
                              <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[11px] text-sky-200">
                                Signed in
                              </span>
                            ) : (
                              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white/45">
                                Guest
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {visitor.geoSource === 'gps' ? (
                              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] font-medium text-emerald-200">
                                Live GPS
                              </span>
                            ) : (
                              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] text-amber-100/80">
                                IP approx
                              </span>
                            )}
                          </div>
                          <div className="space-y-1 font-mono text-[11px] leading-relaxed text-white/55">
                            <div>
                              <span className="text-white/35">Where · </span>
                              {visitor.preciseLocation || visitor.location || 'Location unknown'}
                            </div>
                            {visitor.latitude != null && visitor.longitude != null && (
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                <span>
                                  {visitor.latitude.toFixed(5)}, {visitor.longitude.toFixed(5)}
                                  {visitor.accuracyM != null
                                    ? ` · ±${Math.round(visitor.accuracyM)}m`
                                    : ''}
                                </span>
                                {visitor.mapsUrl && (
                                  <a
                                    href={visitor.mapsUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-emerald-300/90 underline-offset-2 hover:text-emerald-200 hover:underline"
                                  >
                                    Open map
                                  </a>
                                )}
                              </div>
                            )}
                            <div>IP {visitor.ipAddress || '—'}</div>
                          </div>
                        </div>
                        <div className="text-right text-xs text-white/45">
                          <div>{formatScreen(visitor.screen)}</div>
                          <div>seen {formatTime(visitor.lastSeenAt)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-white/45">
                    Nobody is online right now. Open the site in another tab and allow location to appear on the map.
                  </p>
                )}
              </section>

              <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-lg font-semibold">
                    <Users className="h-5 w-5 text-sky-400" />
                    Queue
                  </h2>
                  <span className="text-xs text-white/40">
                    {data?.queue.length ?? 0} waiting
                  </span>
                </div>
                {data?.queue.length ? (
                  <div className="space-y-2">
                    {data.queue.map((entry) => (
                      <div
                        key={entry.playerName}
                        className="flex items-center justify-between rounded-xl border border-white/5 bg-black/20 px-4 py-3"
                      >
                        <PlayerButton
                          name={entry.playerName}
                          stats={data.players[entry.playerName]}
                          selected={selectedPlayer === entry.playerName}
                          onSelect={handleSelectPlayer}
                        />
                        <span className="text-xs text-white/40">
                          since {formatTime(entry.waitingSince)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-white/45">No players in queue right now.</p>
                )}
              </section>

              <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-lg font-semibold">
                    <Swords className="h-5 w-5 text-amber-400" />
                    Active Matches
                  </h2>
                  <span className="text-xs text-white/40">
                    {data?.activeMatches.length ?? 0} in progress
                  </span>
                </div>
                {data?.activeMatches.length ? (
                  <div className="space-y-3">
                    {data.activeMatches.map((match) => (
                      <div
                        key={match.roomId}
                        className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-3">
                            <PlayerButton
                              name={match.player0Name}
                              stats={data.players[match.player0Name]}
                              selected={selectedPlayer === match.player0Name}
                              onSelect={handleSelectPlayer}
                            />
                            <span className="text-xs font-semibold uppercase tracking-wider text-amber-300/80">
                              vs
                            </span>
                            <PlayerButton
                              name={match.player1Name}
                              stats={data.players[match.player1Name]}
                              selected={selectedPlayer === match.player1Name}
                              onSelect={handleSelectPlayer}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              void cancelMatch(
                                match.roomId,
                                `${match.player0Name} vs ${match.player1Name}`,
                              )
                            }
                            disabled={cancellingRoomId === match.roomId}
                            className="rounded-lg border border-rose-400/40 bg-rose-500/15 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-rose-100 transition-colors hover:bg-rose-500/25 disabled:cursor-wait disabled:opacity-60"
                          >
                            {cancellingRoomId === match.roomId ? 'Cancelling…' : 'Cancel game'}
                          </button>
                        </div>
                        <p className="mt-2 text-xs text-white/40">
                          Started {formatTime(match.startedAt)} · Room {match.roomId.slice(0, 8)}…
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-white/45">No active matches.</p>
                )}
              </section>

              <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-lg font-semibold">
                    <Trophy className="h-5 w-5 text-emerald-400" />
                    Recent Results
                  </h2>
                  <span className="text-xs text-white/40">Last updated {formatTime(data?.updatedAt ?? null)}</span>
                </div>
                {data?.recentMatches.length ? (
                  <div className="space-y-3">
                    {data.recentMatches.map((match) => (
                      <div
                        key={`${match.roomId}-${match.endedAt ?? match.startedAt}`}
                        className="rounded-xl border border-white/5 bg-black/20 px-4 py-4"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <PlayerButton
                            name={match.player0Name}
                            stats={data.players[match.player0Name]}
                            selected={selectedPlayer === match.player0Name}
                            onSelect={handleSelectPlayer}
                          />
                          <span className="text-xs text-white/35">vs</span>
                          <PlayerButton
                            name={match.player1Name}
                            stats={data.players[match.player1Name]}
                            selected={selectedPlayer === match.player1Name}
                            onSelect={handleSelectPlayer}
                          />
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                          {match.winnerName ? (
                            <>
                              <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-emerald-300">
                                W {match.winnerName}
                              </span>
                              <span className="rounded-full bg-red-500/15 px-2.5 py-1 text-red-300">
                                L {match.loserName}
                              </span>
                            </>
                          ) : (
                            <span className="rounded-full bg-white/10 px-2.5 py-1 text-white/70">
                              Draw
                            </span>
                          )}
                          <span className="text-xs text-white/40">
                            {formatReason(match.endReason)} · {formatTime(match.endedAt)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-white/45">No completed matches yet.</p>
                )}
              </section>
            </div>

            <aside className="h-fit rounded-2xl border border-white/10 bg-white/[0.03] p-5 lg:sticky lg:top-6">
              <h2 className="mb-4 text-lg font-semibold">Player Profile</h2>
              {profile ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-2xl font-semibold">{profile.playerName}</p>
                    <p className="mt-1 text-sm text-white/50">
                      Record {profile.record}
                      {profile.winRate !== null ? ` · ${profile.winRate}% win rate` : ''}
                    </p>
                    <p className="mt-1 text-xs text-white/40">
                      Last played {formatTime(profile.lastPlayedAt)}
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-lg bg-emerald-500/10 px-3 py-2 text-center">
                      <div className="text-lg font-semibold text-emerald-300">{profile.wins}</div>
                      <div className="text-[10px] uppercase tracking-wide text-white/40">Wins</div>
                    </div>
                    <div className="rounded-lg bg-red-500/10 px-3 py-2 text-center">
                      <div className="text-lg font-semibold text-red-300">{profile.losses}</div>
                      <div className="text-[10px] uppercase tracking-wide text-white/40">Losses</div>
                    </div>
                    <div className="rounded-lg bg-white/5 px-3 py-2 text-center">
                      <div className="text-lg font-semibold">{profile.draws}</div>
                      <div className="text-[10px] uppercase tracking-wide text-white/40">Draws</div>
                    </div>
                  </div>

                  <div>
                    <h3 className="mb-2 text-sm font-medium text-white/70">Recent matches</h3>
                    {profile.recentMatches.length ? (
                      <div className="space-y-2">
                        {profile.recentMatches.map((match) => (
                          <div
                            key={`${match.roomId}-${match.endedAt}`}
                            className="rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-sm"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <button
                                type="button"
                                onClick={() => handleSelectPlayer(match.opponent)}
                                className="font-medium text-left hover:text-emerald-300"
                              >
                                vs {match.opponent}
                              </button>
                              <span
                                className={
                                  match.result === 'win'
                                    ? 'text-emerald-300'
                                    : match.result === 'loss'
                                      ? 'text-red-300'
                                      : 'text-white/50'
                                }
                              >
                                {match.result.toUpperCase()}
                              </span>
                            </div>
                            <p className="text-xs text-white/40">
                              {formatReason(match.endReason)} · {formatTime(match.endedAt)}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-white/45">No match history for this player.</p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={clearProfile}
                    className="w-full rounded-lg border border-white/10 px-3 py-2 text-sm text-white/60 hover:bg-white/5"
                  >
                    Clear selection
                  </button>
                </div>
              ) : (
                <p className="text-sm text-white/45">
                  Click any player name to view their profile, win/loss record, and recent matches.
                </p>
              )}
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
