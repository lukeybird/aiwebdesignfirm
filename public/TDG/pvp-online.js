(function () {
  const STORAGE_KEY = 'tdg_pvp_session';

  let pusher = null;
  let playerChannel = null;
  let roomChannel = null;
  let gameSocket = null;
  let session = null;
  let heartbeatTimer = null;
  let disconnecting = false;
  let gameWsUrl = null;
  let serverAuthEnabled = false;
  let socketReady = false;
  let queueMode = 'standard'; // 'standard' | 'limited' | 'tft'
  const HEARTBEAT_INTERVAL_MS = 10000;
  const pendingSocketMessages = [];

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
    closeGameSocket();
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
    gameWsUrl = config.gameWsUrl || null;
    serverAuthEnabled = Boolean(config.serverAuth && config.gameWsUrl);
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

  function closeGameSocket() {
    socketReady = false;
    pendingSocketMessages.length = 0;
    if (gameSocket) {
      try {
        gameSocket.onopen = null;
        gameSocket.onmessage = null;
        gameSocket.onclose = null;
        gameSocket.onerror = null;
        if (gameSocket.readyState === WebSocket.OPEN || gameSocket.readyState === WebSocket.CONNECTING) {
          gameSocket.close();
        }
      } catch {
        // ignore
      }
      gameSocket = null;
    }
  }

  function socketSend(obj) {
    if (!gameSocket || gameSocket.readyState !== WebSocket.OPEN) {
      pendingSocketMessages.push(obj);
      return;
    }
    gameSocket.send(JSON.stringify(obj));
  }

  function flushPendingSocketMessages() {
    while (pendingSocketMessages.length && gameSocket?.readyState === WebSocket.OPEN) {
      const msg = pendingSocketMessages.shift();
      gameSocket.send(JSON.stringify(msg));
    }
  }

  function handleGameSocketMessage(msg) {
    if (!msg || typeof msg !== 'object') return;

    if (msg.type === 'joined') {
      socketReady = true;
      if (session && (msg.authoritySlot === 0 || msg.authoritySlot === 1)) {
        session.authoritySlot = msg.authoritySlot;
        saveSession(session);
      }
      return;
    }

    if (msg.type === 'match_ready') {
      // Countdown already scheduled from matchmaking; sync startsAt if provided.
      if (session && msg.startsAt) {
        session.startsAt = msg.startsAt;
        if (msg.authoritySlot === 0 || msg.authoritySlot === 1) {
          session.authoritySlot = msg.authoritySlot;
        }
        saveSession(session);
      }
      return;
    }

    if (msg.type === 'tick') {
      window.__TDG?.applyServerTick?.(msg);
      return;
    }

    if (msg.type === 'world') {
      window.__TDG?.applyServerWorld?.(msg);
      return;
    }

    if (msg.type === 'forfeit') {
      if (!window.__TDG?.isSurvivalPvp?.()) return;
      const snap = window.__TDG.getPvpSnapshot?.();
      const loser = msg.from;
      if (snap?.players?.[loser]) snap.players[loser].baseHp = 0;
      if (snap) window.__TDG.applyPvpSnapshot?.(snap);
      return;
    }

    if (msg.type === 'peer_disconnect') {
      // Soft notice; server grace timer handles forfeit.
      return;
    }

    if (msg.type === 'error') {
      console.warn('TDG game server error:', msg.error);
    }
  }

  function connectGameSocket(match) {
    closeGameSocket();
    if (!gameWsUrl) return Promise.reject(new Error('Game server URL not configured'));

    return new Promise((resolve, reject) => {
      let settled = false;
      const ws = new WebSocket(gameWsUrl);
      gameSocket = ws;

      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error('Game server connection timed out'));
        closeGameSocket();
      }, 12000);

      ws.onopen = () => {
        socketSend({
          type: 'join',
          ticket: match.joinTicket || undefined,
          roomId: match.roomId,
          sessionToken: match.sessionToken,
        });
        flushPendingSocketMessages();
      };

      ws.onmessage = (ev) => {
        const msg = (() => {
          try {
            return JSON.parse(ev.data);
          } catch {
            return null;
          }
        })();
        if (msg?.type === 'joined' && !settled) {
          settled = true;
          clearTimeout(timer);
          resolve();
        }
        handleGameSocketMessage(msg);
      };

      ws.onerror = () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(new Error('Game server connection failed'));
        }
      };

      ws.onclose = () => {
        socketReady = false;
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(new Error('Game server disconnected'));
        }
      };
    });
  }

  function showNameScreen(mode) {
    queueMode = mode === 'limited' ? 'limited' : (mode === 'tft' ? 'tft' : 'standard');
    hide($('menu-screen'));
    hide($('online-queue-screen'));
    hide($('online-match-screen'));
    hide($('limited-draft-screen'));
    hide($('tft-game-screen'));
    show($('online-name-screen'));
    const title = $('online-name-title');
    const desc = $('online-name-desc');
    if (queueMode === 'limited') {
      if (title) title.textContent = '🃏 Limited PvP';
      if (desc) desc.textContent = 'Snake-draft 10 cards each, then fight online. Drafted cards still cost gold to unlock. Limited players only match other Limited players.';
    } else if (queueMode === 'tft') {
      if (title) title.textContent = '⚔️ TFT Online';
      if (desc) desc.textContent = 'Auto-battler online: shop each round, place units on your board, stack traits, and reduce enemy HP to zero.';
    } else {
      if (title) title.textContent = '🌐 Online PvP';
      if (desc) desc.textContent = 'Enter your name, join the queue, and battle a real opponent in Live Battle mode.';
    }
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
    hide($('limited-draft-screen'));
    hide($('tft-game-screen'));
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
    // Legacy Pusher room path (fallback when game WS is not configured).
    if (roomChannel) {
      roomChannel.unbind_all();
      pusher?.unsubscribe(roomChannel.name);
      roomChannel = null;
    }
    roomChannel = pusher.subscribe(`tdg-room-${roomId}`);
    roomChannel.bind('state', (payload) => {
      if (!window.__TDG?.isSurvivalPvp?.()) return;
      if (session?.isHost || session?.playerId === 0) return;
      window.__TDG.applyAuthoritativeState?.(payload.state);
    });
    roomChannel.bind('action', (payload) => {
      if (window.__TDG?.handleLimitedDraftRemote?.(payload.from, payload.action)) return;
      if (window.TFT_ONLINE?.handleRemote?.(payload.from, payload.action)) return;
      if (!window.__TDG?.isSurvivalPvp?.()) return;
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

  async function startOnlineMatch(match) {
    const myId = match.playerId;
    const p0 = myId === 0 ? match.playerName : match.opponentName;
    const p1 = myId === 1 ? match.playerName : match.opponentName;
    const useServerAuth = Boolean(match.serverAuth && match.joinTicket && gameWsUrl);

    hideOnlineScreens();
    hide($('menu-screen'));

    const limited = Boolean(match.limited || queueMode === 'limited' || session?.limited);
    const tft = Boolean(match.tft || queueMode === 'tft' || session?.tft);

    if (useServerAuth) {
      try {
        await connectGameSocket(match);
      } catch (err) {
        console.warn('Game WS failed, falling back to Pusher room sync', err);
        subscribeToRoomChannel(match.roomId);
        match.serverAuth = false;
      }
    } else {
      subscribeToRoomChannel(match.roomId);
    }
    // Limited draft syncs over the Pusher room channel even when game WS is up.
    if ((limited || tft) && !roomChannel) {
      subscribeToRoomChannel(match.roomId);
    }

    const startsAt = match.startsAt || Date.now() + 4000;

    function beginCombat(limitedPicks) {
      runCountdown(Date.now() + 3200, () => {
        window.__TDG.setupSurvivalLivePvp({
          player0Name: p0,
          player1Name: p1,
          myPlayerId: myId,
          isHost: match.isHost,
          roomId: match.roomId,
          sessionToken: match.sessionToken,
          opponentName: match.opponentName,
          startsAt,
          serverAuth: Boolean(match.serverAuth && gameSocket),
          authoritySlot: match.authoritySlot === 1 ? 1 : 0,
          limited,
          limitedPicks,
        });
      });
    }

    if (limited) {
      window.__TDG.startLimitedDraftSession({
        myPlayerId: myId,
        player0Name: p0,
        player1Name: p1,
        onComplete: beginCombat,
      });
      return;
    }

    if (tft) {
      runCountdown(startsAt, () => {
        window.TFT_ONLINE?.start({
          player0Name: p0,
          player1Name: p1,
          myPlayerId: myId,
          isHost: match.isHost,
          roomId: match.roomId,
        });
      });
      return;
    }

    runCountdown(startsAt, () => beginCombat(null));
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
      joinTicket: data.joinTicket || session?.joinTicket || null,
      serverAuth: data.serverAuth ?? Boolean(data.joinTicket),
      authoritySlot: data.authoritySlot === 1 ? 1 : 0,
      limited: Boolean(data.limited || queueMode === 'limited' || session?.limited),
      tft: Boolean(data.tft || queueMode === 'tft' || session?.tft),
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
      mode: queueMode === 'limited' ? 'limited' : (queueMode === 'tft' ? 'tft' : 'standard'),
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
      joinTicket: result.joinTicket || null,
      serverAuth: result.serverAuth || false,
      authoritySlot: result.authoritySlot === 1 ? 1 : 0,
      limited: Boolean(result.limited || queueMode === 'limited'),
      tft: Boolean(result.tft || queueMode === 'tft'),
    });

    await ensurePusher();
    subscribeToPlayerChannel(result.sessionToken);
    startHeartbeat();

    if (result.status === 'matched') {
      showMatchScreen(result.playerName || name, result.opponentName);
      setTimeout(() => startOnlineMatch({
        ...result,
        playerName: result.playerName || name,
        limited: Boolean(result.limited || queueMode === 'limited'),
        tft: Boolean(result.tft || queueMode === 'tft'),
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

    const nested = action?.action && action.action.type ? action.action : action;
    const isDraftPick = nested?.type === 'limited_draft_pick' || action?.type === 'limited_draft_pick';
    const isTftPick = String(nested?.type || action?.type || '').startsWith('tft_');

    // Preferred path: authoritative game WebSocket (draft/TFT picks stay on Pusher/HTTP)
    if (!isDraftPick && !isTftPick && gameSocket && (socketReady || gameSocket.readyState === WebSocket.OPEN)) {
      const aid = action?.aid;
      socketSend({
        type: 'input',
        aid: aid || nested?.__aid || `${session.playerId}-${Date.now()}`,
        action: nested?.type ? nested : action,
      });
      return;
    }

    // Legacy HTTP → Pusher path
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

  async function sendState(state) {
    if (!session?.roomId || !session?.sessionToken) return;

    // Server-auth: designated authority publishes full world via WebSocket.
    if (session.serverAuth && gameSocket) {
      const authSlot = session.authoritySlot === 1 ? 1 : 0;
      if (session.playerId !== authSlot) return;
      socketSend({ type: 'state', state });
      return;
    }

    if (!(session.isHost || session.playerId === 0)) return;
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
        keepalive: true,
      });
    } catch (err) {
      console.warn('sync failed', err);
    }
  }

  async function notifyGameOver(outcome) {
    if (!session?.roomId || !session?.sessionToken || session.reportedGameOver) return;
    session.reportedGameOver = true;
    saveSession(session);

    const winnerSlot =
      outcome?.winnerSlot === 0 || outcome?.winnerSlot === 1 ? outcome.winnerSlot : null;
    const endReason =
      outcome?.endReason === 'draw' || winnerSlot === null ? 'draw' : 'base_destroyed';

    if (gameSocket && gameSocket.readyState === WebSocket.OPEN) {
      socketSend({
        type: 'checksum',
        report: {
          phase: 'gameover',
          winnerSlot,
          endReason,
          baseHp: outcome?.baseHp,
        },
      });
    }

    try {
      await fetchJson('/api/tdg-pvp/match-complete', {
        method: 'POST',
        body: JSON.stringify({
          roomId: session.roomId,
          sessionToken: session.sessionToken,
          winnerSlot,
          endReason,
        }),
      });
    } catch {
      // ignore — opponent may have reported first
    }
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
    closeGameSocket();
    clearSession();
    pusher?.disconnect();
    pusher = null;
  }

  async function forfeitMatch() {
    if (!session?.roomId || !session?.sessionToken) return;
    if (gameSocket && gameSocket.readyState === WebSocket.OPEN) {
      socketSend({ type: 'forfeit' });
    }
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
    $('btn-online-pvp')?.addEventListener('click', () => showNameScreen('standard'));
    $('btn-limited-pvp')?.addEventListener('click', () => showNameScreen('limited'));
    $('btn-tft-online')?.addEventListener('click', () => showNameScreen('tft'));
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
    sendState,
    notifyGameOver,
    cleanup,
    leaveQueue,
    forfeitMatch,
    usesServerAuth: () => Boolean(session?.serverAuth && gameSocket),
  };

  bindUi();
})();
