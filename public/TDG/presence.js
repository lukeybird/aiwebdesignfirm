/**
 * Presence heartbeat for /TDG visitors.
 * Sends screen + optional device GPS so /activity can show exact location.
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'tdg_presence_visitor_id';
  const PING_MS = 15000;
  const GEO_REFRESH_MS = 20000;

  /** @type {{ lat: number, lng: number, accuracy: number } | null} */
  let lastGps = null;
  let geoWatchId = null;
  let geoAsked = false;

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

  function onGeoSuccess(pos) {
    if (!pos || !pos.coords) return;
    lastGps = {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
    };
  }

  function startGeoTracking() {
    if (geoAsked || !navigator.geolocation) return;
    geoAsked = true;
    try {
      navigator.geolocation.getCurrentPosition(onGeoSuccess, function () {}, {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 12000,
      });
      geoWatchId = navigator.geolocation.watchPosition(onGeoSuccess, function () {}, {
        enableHighAccuracy: true,
        maximumAge: GEO_REFRESH_MS,
        timeout: 20000,
      });
    } catch {
      // Permission / insecure context
    }
  }

  async function ping(leave) {
    const visitorId = getVisitorId();
    const body = leave
      ? { visitorId: visitorId, leave: true }
      : {
          visitorId: visitorId,
          displayName: await resolveDisplayName(),
          screen: visibleScreen(),
        };

    if (!leave && lastGps) {
      body.lat = lastGps.lat;
      body.lng = lastGps.lng;
      body.accuracy = lastGps.accuracy;
    }

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
        keepalive: !!leave,
      });
    } catch {
      // ignore network blips
    }
  }

  let timer = null;
  function start() {
    startGeoTracking();
    void ping(false);
    if (timer) clearInterval(timer);
    timer = setInterval(function () {
      if (document.visibilityState === 'hidden') return;
      void ping(false);
    }, PING_MS);
  }

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') {
      startGeoTracking();
      void ping(false);
    }
  });

  window.addEventListener('pagehide', function () {
    if (geoWatchId != null && navigator.geolocation && navigator.geolocation.clearWatch) {
      try { navigator.geolocation.clearWatch(geoWatchId); } catch (e) {}
    }
    void ping(true);
  });

  // Prompt for location shortly after load (HTTPS required).
  setTimeout(startGeoTracking, 800);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
