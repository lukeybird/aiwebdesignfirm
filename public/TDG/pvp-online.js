(function () {
  const STORAGE_KEY = 'tdg_pvp_session';

  let pusher = null;
  let playerChannel = null;
  let roomChannel = null;
  let session = null;
  let lastSyncAt = 0;
  const SYNC_INTERVAL_MS = 120;

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
  }

  function subscribeToRoomChannel(roomId) {
    roomChannel = pusher.subscribe(`tdg-room-${roomId}`);
    roomChannel.bind('state', (payload) => {
      if (!session || session.isHost) return;
      window.__TDG?.applyPvpSnapshot(payload.state);
    });
    roomChannel.bind('action', (payload) => {
      if (!session?.isHost) return;
      window.__TDG?.applyPvpRemoteAction(payload.from, payload.action);
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
  }

  async function sendAction(action) {
    if (!session?.roomId || !session?.sessionToken) return;
    try {
      await fetchJson('/api/tdg-pvp/action', {
        method: 'POST',
        body: JSON.stringify({
          roomId: session.roomId,
          sessionToken: session.sessionToken,
          action,
        }),
      });
    } catch (err) {
      console.warn('action failed', err);
    }
  }

  async function syncState(state) {
    if (!session?.roomId || !session?.sessionToken || !session.isHost) return;
    try {
      await fetchJson('/api/tdg-pvp/sync', {
        method: 'POST',
        body: JSON.stringify({
          roomId: session.roomId,
          sessionToken: session.sessionToken,
          state,
        }),
      });
    } catch (err) {
      console.warn('sync failed', err);
    }
  }

  function tickHost() {
    const now = Date.now();
    if (now - lastSyncAt < SYNC_INTERVAL_MS) return;
    lastSyncAt = now;
    const state = window.__TDG?.getPvpSnapshot?.();
    if (state) syncState(state);
  }

  async function notifyGameOver() {
    if (!session?.roomId || !session?.sessionToken || !session.isHost) return;
    const state = window.__TDG?.getPvpSnapshot?.();
    if (!state) return;
    state.phase = 'gameover';
    await syncState(state);
  }

  function cleanup() {
    disconnectChannels();
    clearSession();
    pusher?.disconnect();
    pusher = null;
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
  }

  window.TDG_PVP = {
    sendAction,
    tickHost,
    notifyGameOver,
    cleanup,
    leaveQueue,
  };

  bindUi();
})();
