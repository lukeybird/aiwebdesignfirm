(function () {
  const STORAGE_KEY = 'tdg_pvp_session';

  let pusher = null;
  let playerChannel = null;
  let roomChannel = null;
  let session = null;
  let lastSyncAt = 0;
  let heartbeatTimer = null;
  let disconnecting = false;
  const SYNC_INTERVAL_MS = 33;
  const HEARTBEAT_INTERVAL_MS = 10000;

  function $(id) {
    return document.getElementById(id);
  }

  function hide(el) {
    if (el) el.classList.add('hidden');
  }

  function show(el) {
    if (el) el.classList.remove('hidden');
  }

  function loadStoredSession() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function saveSession(data) {
    session = data;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function clearSession() {
    session = null;
    sessionStorage.removeItem(STORAGE_KEY);
  }

  async function fetchJson(url, options) {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers || {}),
      },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  function stopHeartbeat() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }

  async function pingSession() {
    if (!session?.sessionToken) return true;
    try {
      const data = await fetchJson('/api/tdg-pvp/ping', {
        method: 'POST',
        body: JSON.stringify({ sessionToken: session.sessionToken }),
      });
      if (data.status === 'gone') {
        handleSessionExpired('Your queue session expired. Please find a match again.');
        return false;
      }
      return true;
    } catch {
      return true;
    }
  }

  function startHeartbeat() {
    stopHeartbeat();
    if (!session?.sessionToken) return;
    void pingSession();
    heartbeatTimer = setInterval(() => {
      void pingSession();
    }, HEARTBEAT_INTERVAL_MS);
  }

  function handleSessionExpired(message) {
    if (disconnecting) return;
    stopHeartbeat();
    disconnectChannels();
    clearSession();
    hideOnlineScreens();
    show($('menu-screen'));
    if (message) alert(message);
  }

  function handleMatchCancelled() {
    handleSessionExpired('Your opponent disconnected. Returning to menu.');
  }

  function sendLeaveBeacon() {
    const stored = loadStoredSession();
    if (!stored?.sessionToken) return;
    const payload = JSON.stringify({ sessionToken: stored.sessionToken });
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/tdg-pvp/leave', new Blob([payload], { type: 'application/json' }));
        return;
      }
    } catch {
      // fall through
    }
    fetch('/api/tdg-pvp/leave', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  }

  async function ensurePusher() {
    if (pusher) return pusher;
    const config = await fetchJson('/api/tdg-pvp/config');
    if (!window.Pusher) throw new Error('Pusher failed to load');
    pusher = new window.Pusher(config.key, { cluster: config.cluster });
    return pusher;
  }

  function disconnectChannels() {
    if (playerChannel) {
      playerChannel.unbind_all();
      pusher?.unsubscribe(playerChannel.name);
      playerChannel = null;
    }
    if (roomChannel) {
      roomChannel.unbind_all();
      pusher?.unsubscribe(roomChannel.name);
      roomChannel = null;
    }
  }

  function showNameScreen() {
    hide($('menu-screen'));
    hide($('online-queue-screen'));
    hide($('online-match-screen'));
    show($('online-name-screen'));
    const stored = loadStoredSession();
    const input = $('online-name-input');
    if (input && stored?.playerName) input.value = stored.playerName;
    input?.focus();
  }

  function showQueueScreen(name) {
    hide($('online-name-screen'));
    hide($('online-match-screen'));
    show($('online-queue-screen'));
    const label = $('online-queue-name');
    if (label) label.textContent = name;
  }

  function showMatchScreen(youName, themName) {
    hide($('online-queue-screen'));
    hide($('online-name-screen'));
    show($('online-match-screen'));
    const you = $('online-you-name');
    const them = $('online-them-name');
    if (you) you.textContent = youName;
    if (them) them.textContent = themName;
  }

  function hideOnlineScreens() {
    hide($('online-name-screen'));
    hide($('online-queue-screen'));
    hide($('online-match-screen'));
    hide($('countdown-overlay'));
  }

  function runCountdown(startsAt, onDone) {
    const overlay = $('countdown-overlay');
    const numberEl = $('countdown-number');
    show(overlay);

    function tick() {
      const remaining = startsAt - Date.now();
      if (remaining <= 0) {
        numberEl.textContent = 'BEGIN!';
        setTimeout(() => {
          hide(overlay);
          onDone();
        }, 650);
        return;
      }
      const sec = Math.ceil(remaining / 1000);
      numberEl.textContent = sec > 3 ? '3' : String(sec);
      numberEl.style.animation = 'none';
      void numberEl.offsetWidth;
      numberEl.style.animation = '';
      requestAnimationFrame(tick);
    }

    tick();
  }

  function subscribeToPlayerChannel(token) {
    const channelName = `tdg-player-${token}`;
    playerChannel = pusher.subscribe(channelName);
    playerChannel.bind('match_found', (data) => {
      handleMatchFound({
        ...data,
        sessionToken: token,
        playerName: session?.playerName || data.opponentName,
      });
    });
    playerChannel.bind('match_cancelled', () => {
      handleMatchCancelled();
    });
  }

  function subscribeToRoomChannel(roomId) {
    roomChannel = pusher.subscribe(`tdg-room-${roomId}`);
    roomChannel.bind('state', (payload) => {
      if (!session || session.isHost) return;
      window.__TDG?.applyPvpSnapshot(payload.state, payload.t);
    });
    roomChannel.bind('action', (payload) => {
      if (!session?.isHost) return;
      const applied = window.__TDG?.applyPvpRemoteAction(payload.from, payload.action);
      if (applied) forceHostSync();
    });
    roomChannel.bind('forfeit', (payload) => {
      if (!window.__TDG?.isSurvivalPvp?.()) return;
      const snap = window.__TDG.getPvpSnapshot();
      const loser = payload.from;
      if (snap?.players?.[loser]) snap.players[loser].baseHp = 0;
      window.__TDG.applyPvpSnapshot(snap);
    });
  }

  function startOnlineMatch(match) {
    const myId = match.playerId;
    const p0 = myId === 0 ? match.playerName : match.opponentName;
    const p1 = myId === 1 ? match.playerName : match.opponentName;

    hideOnlineScreens();
    hide($('menu-screen'));

    subscribeToRoomChannel(match.roomId);

    const startsAt = match.startsAt || Date.now() + 4000;
    runCountdown(startsAt, () => {
      window.__TDG.setupSurvivalLivePvp({
        player0Name: p0,
        player1Name: p1,
        myPlayerId: myId,
        isHost: match.isHost,
        roomId: match.roomId,
        sessionToken: match.sessionToken,
        opponentName: match.opponentName,
      });
    });
  }

  function handleMatchFound(data) {
    const match = {
      status: 'matched',
      sessionToken: data.sessionToken || session?.sessionToken,
      roomId: data.roomId,
      playerId: data.playerId,
      opponentName: data.opponentName,
      isHost: data.isHost,
      playerName: session?.playerName || data.playerName,
      startsAt: data.startsAt || Date.now() + 4000,
    };
    saveSession(match);
    showMatchScreen(match.playerName, match.opponentName);
    setTimeout(() => startOnlineMatch(match), 1400);
  }

  async function joinQueue(name) {
    const existing = loadStoredSession();
    const body = {
      name,
      sessionToken: existing?.sessionToken,
    };
    const result = await fetchJson('/api/tdg-pvp/join', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    saveSession({
      sessionToken: result.sessionToken,
      playerName: result.playerName || name,
      roomId: result.roomId,
      playerId: result.playerId,
      opponentName: result.opponentName,
      isHost: result.isHost,
      status: result.status,
      startsAt: result.startsAt,
    });

    await ensurePusher();
    subscribeToPlayerChannel(result.sessionToken);
    startHeartbeat();

    if (result.status === 'matched') {
      showMatchScreen(result.playerName || name, result.opponentName);
      setTimeout(() => startOnlineMatch({
        ...result,
        playerName: result.playerName || name,
      }), 1400);
      return;
    }

    showQueueScreen(name);
  }

  async function leaveQueue() {
    disconnecting = true;
    const stored = loadStoredSession();
    if (stored?.sessionToken) {
      try {
        await fetchJson('/api/tdg-pvp/leave', {
          method: 'POST',
          body: JSON.stringify({ sessionToken: stored.sessionToken }),
        });
      } catch {
        // ignore
      }
    }
    cleanup();
    hideOnlineScreens();
    show($('menu-screen'));
    disconnecting = false;
  }

  async function sendAction(action) {
    if (!session?.roomId || !session?.sessionToken) return;
    const body = JSON.stringify({
      roomId: session.roomId,
      sessionToken: session.sessionToken,
      action,
    });
    try {
      await fetch('/api/tdg-pvp/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      });
    } catch (err) {
      console.warn('action failed', err);
    }
  }

  async function syncState(state, urgent = false) {
    if (!session?.roomId || !session?.sessionToken || !session.isHost) return;
    const body = JSON.stringify({
      roomId: session.roomId,
      sessionToken: session.sessionToken,
      state,
    });
    try {
      await fetch('/api/tdg-pvp/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: !urgent,
      });
    } catch (err) {
      console.warn('sync failed', err);
    }
  }

  function pushState(state) {
    if (!session?.isHost) return;
    void syncState(state);
  }

  function forceHostSync() {
    if (!session?.isHost) return;
    lastSyncAt = 0;
    const state = window.__TDG?.getPvpSnapshot?.();
    if (state) void syncState(state, true);
  }

  function tickHost() {
    const now = Date.now();
    if (now - lastSyncAt < SYNC_INTERVAL_MS) return;
    lastSyncAt = now;
    const state = window.__TDG?.getPvpSnapshot?.();
    if (state) pushState(state);
  }

  async function notifyGameOver() {
    if (!session?.roomId || !session?.sessionToken || !session.isHost) return;
    const state = window.__TDG?.getPvpSnapshot?.();
    if (!state) return;
    state.phase = 'gameover';
    await syncState(state);
  }

  function cleanup() {
    stopHeartbeat();
    const token = session?.sessionToken || loadStoredSession()?.sessionToken;
    if (token) {
      fetch('/api/tdg-pvp/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionToken: token }),
        keepalive: true,
      }).catch(() => {});
    }
    disconnectChannels();
    clearSession();
    pusher?.disconnect();
    pusher = null;
  }

  async function forfeitMatch() {
    if (!session?.roomId || !session?.sessionToken) return;
    try {
      await fetchJson('/api/tdg-pvp/forfeit', {
        method: 'POST',
        body: JSON.stringify({
          roomId: session.roomId,
          sessionToken: session.sessionToken,
        }),
      });
    } catch {
      // ignore
    }
  }

  function bindUi() {
    $('btn-online-pvp')?.addEventListener('click', showNameScreen);
    $('btn-online-name-back')?.addEventListener('click', () => {
      hide($('online-name-screen'));
      show($('menu-screen'));
    });
    $('btn-online-cancel')?.addEventListener('click', leaveQueue);
    $('btn-online-find')?.addEventListener('click', async () => {
      const input = $('online-name-input');
      const name = input?.value?.trim() || '';
      if (name.length < 2) {
        alert('Enter a name with at least 2 characters.');
        input?.focus();
        return;
      }
      const btn = $('btn-online-find');
      if (btn) btn.disabled = true;
      try {
        await joinQueue(name);
      } catch (err) {
        alert(err.message || 'Could not join queue.');
      } finally {
        if (btn) btn.disabled = false;
      }
    });
    $('online-name-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') $('btn-online-find')?.click();
    });

    window.addEventListener('pagehide', () => {
      if (loadStoredSession()?.sessionToken) sendLeaveBeacon();
    });
    window.addEventListener('beforeunload', () => {
      if (loadStoredSession()?.sessionToken) sendLeaveBeacon();
    });
  }

  window.TDG_PVP = {
    sendAction,
    tickHost,
    pushState,
    forceHostSync,
    notifyGameOver,
    cleanup,
    leaveQueue,
    forfeitMatch,
    SYNC_INTERVAL_MS,
  };

  bindUi();
})();
