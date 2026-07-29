/**
 * Lightweight presence heartbeat for /TDG visitors.
 * Lets /activity show how many people are on the game right now.
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'tdg_presence_visitor_id';
  const PING_MS = 15000;

  function uuid() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }

  function getVisitorId() {
    try {
      let id = localStorage.getItem(STORAGE_KEY);
      if (!id || id.length < 8) {
        id = uuid();
        localStorage.setItem(STORAGE_KEY, id);
      }
      return id;
    } catch {
      return uuid();
    }
  }

  function visibleScreen() {
    const checks = [
      ['tft-game-screen', 'tft'],
      ['online-queue-screen', 'queue'],
      ['online-match-screen', 'match'],
      ['online-name-screen', 'name'],
      ['limited-draft-screen', 'draft'],
      ['survival-difficulty-screen', 'survival'],
      ['manual-screen', 'manual'],
      ['rulebook-screen', 'rulebook'],
      ['menu-screen', 'menu'],
    ];
    for (const [id, label] of checks) {
      const el = document.getElementById(id);
      if (el && !el.classList.contains('hidden')) return label;
    }
    return 'playing';
  }

  async function resolveDisplayName() {
    const input = document.getElementById('online-name-input');
    if (input && 'value' in input && String(input.value || '').trim()) {
      return String(input.value).trim().slice(0, 50);
    }
    try {
      const res = await fetch('/api/account/profile', { credentials: 'include', cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data?.authenticated && data.user?.displayName) return String(data.user.displayName).slice(0, 50);
        if (data?.authenticated && data.user?.name) return String(data.user.name).slice(0, 50);
      }
    } catch {
      // ignore
    }
    try {
      const raw = sessionStorage.getItem('tdg_pvp_session');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.playerName) return String(parsed.playerName).slice(0, 50);
      }
    } catch {
      // ignore
    }
    return null;
  }

  async function ping(leave = false) {
    const visitorId = getVisitorId();
    const body = leave
      ? { visitorId, leave: true }
      : {
          visitorId,
          displayName: await resolveDisplayName(),
          screen: visibleScreen(),
        };
    try {
      if (leave && navigator.sendBeacon) {
        navigator.sendBeacon(
          '/api/tdg-pvp/presence',
          new Blob([JSON.stringify(body)], { type: 'application/json' }),
        );
        return;
      }
      await fetch('/api/tdg-pvp/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
        keepalive: leave,
      });
    } catch {
      // ignore network blips
    }
  }

  let timer = null;
  function start() {
    void ping(false);
    if (timer) clearInterval(timer);
    timer = setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      void ping(false);
    }, PING_MS);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void ping(false);
  });

  window.addEventListener('pagehide', () => {
    void ping(true);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
