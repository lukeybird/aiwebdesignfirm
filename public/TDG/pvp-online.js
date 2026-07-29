(function () {
  const STORAGE_KEY = 'tdg_pvp_session';
  const LIVE_STATE_KEY = 'tdg_pvp_live_state';
  const ROOM_SESSION_PREFIX = 'tdg_pvp_room_';

  let pusher = null;
  let playerChannel = null;
  let roomChannel = null;
  let gameSocket = null;
  let session = null;
  let heartbeatTimer = null;
  let disconnecting = false;
  let hardLeaveOnUnload = false;
  let resumeInFlight = false;
  let gameWsUrl = null;
  let serverAuthEnabled = false;
  let socketReady = false;
  let queueMode = 'standard'; // 'standard' | 'limited' | 'tft'
  const HEARTBEAT_INTERVAL_MS = 10000;
  const pendingSocketMessages = [];
  /** Last TFT auth snapshot — kept so a late-booting guest still gets shops. */
  let lastTftAuthState = null;

  function rememberTftAuthState(state) {
    if (state && state.mode === 'tft') {
      lastTftAuthState = state;
      saveLiveState(state, { mode: 'tft' });
    }
  }

  function deliverTftAuthState(state) {
    if (!state || state.mode !== 'tft') return false;
    rememberTftAuthState(state);
    if (window.TFT_ONLINE?.isActive?.()) {
      window.TFT_ONLINE.applyAuthState?.(state);
      return true;
    }
    return false;
  }

  function readGameIdFromUrl() {
    try {
      return new URL(window.location.href).searchParams.get('game') || '';
    } catch {
      return '';
    }
  }

  function readModeFromUrl() {
    try {
      const mode = new URL(window.location.href).searchParams.get('mode');
      if (mode === 'limited' || mode === 'tft' || mode === 'standard') return mode;
      return '';
    } catch {
      return '';
    }
  }

  function normalizeMode(mode) {
    if (mode === 'limited' || mode === 'tft') return mode;
    return 'standard';
  }

  function modeFromSession(data) {
    if (!data) return queueMode || 'standard';
    if (data.tft) return 'tft';
    if (data.limited) return 'limited';
    return 'standard';
  }

  function setGameUrl(roomId, mode) {
    if (!roomId || typeof history === 'undefined' || !window.location) return;
    try {
      const url = new URL(window.location.href);
      const nextMode = normalizeMode(mode || queueMode || modeFromSession(session));
      const same = url.searchParams.get('game') === roomId && url.searchParams.get('mode') === nextMode;
      if (same) return;
      url.searchParams.set('game', roomId);
      url.searchParams.set('mode', nextMode);
      history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    } catch {
      // ignore
    }
  }

  function clearGameUrl() {
    if (typeof history === 'undefined' || !window.location) return;
    try {
      const url = new URL(window.location.href);
      if (!url.searchParams.has('game') && !url.searchParams.has('mode')) return;
      url.searchParams.delete('game');
      url.searchParams.delete('mode');
      const next = `${url.pathname}${url.search}${url.hash}`;
      history.replaceState(null, '', next || url.pathname);
    } catch {
      // ignore
    }
  }

  function saveLiveState(state, meta = {}) {
    const roomId = meta.roomId || session?.roomId;
    if (!roomId || !state) return;
    try {
      sessionStorage.setItem(LIVE_STATE_KEY, JSON.stringify({
        roomId,
        mode: normalizeMode(meta.mode || state.mode || modeFromSession(session)),
        state,
        savedAt: Date.now(),
      }));
    } catch {
      // ignore quota
    }
  }

  function loadLiveState(roomId, expectedMode) {
    if (!roomId) return null;
    try {
      const raw = sessionStorage.getItem(LIVE_STATE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.roomId !== roomId || !parsed.state) return null;
      if (Date.now() - (parsed.savedAt || 0) > 30 * 60 * 1000) return null;
      const stateMode = parsed.mode || parsed.state.mode || 'standard';
      if (expectedMode === 'tft') {
        if (stateMode !== 'tft') return null;
      } else if (expectedMode === 'limited') {
        if (stateMode === 'tft') return null;
      } else if (expectedMode === 'standard') {
        if (stateMode === 'tft' || stateMode === 'limited_draft') return null;
        if (stateMode === 'limited' && parsed.state.limitedPicks) return null;
      }
      return parsed.state;
    } catch {
      return null;
    }
  }

  function clearLiveState() {
    try {
      sessionStorage.removeItem(LIVE_STATE_KEY);
    } catch {
      // ignore
    }
  }


  async function fetchAccountDisplayName() {
    try {
      const res = await fetch('/api/account/profile', { credentials: 'include', cache: 'no-store' });
      if (!res.ok) return null;
      const data = await res.json();
      if (data?.authenticated && data.user?.displayName) return String(data.user.displayName);
    } catch (_) { /* ignore */ }
    return null;
  }

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

  function loadRoomSession(roomId) {
    if (!roomId) return null;
    try {
      const raw = localStorage.getItem(ROOM_SESSION_PREFIX + roomId);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function saveRoomSession(data) {
    if (!data?.roomId || !data?.sessionToken) return;
    try {
      localStorage.setItem(ROOM_SESSION_PREFIX + data.roomId, JSON.stringify({
        sessionToken: data.sessionToken,
        playerName: data.playerName,
        playerId: data.playerId,
        isHost: data.isHost,
        limited: !!data.limited,
        tft: !!data.tft,
        opponentName: data.opponentName,
        limitedPicks: data.limitedPicks || null,
        reportedGameOver: !!data.reportedGameOver,
      }));
    } catch {
      // ignore quota / private mode
    }
  }

  function clearRoomSession(roomId) {
    if (!roomId) return;
    try {
      localStorage.removeItem(ROOM_SESSION_PREFIX + roomId);
    } catch {
      // ignore
    }
  }

  function saveSession(data) {
    session = data;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    saveRoomSession(data);
  }

  function clearSession() {
    const roomId = session?.roomId || loadStoredSession()?.roomId || readGameIdFromUrl();
    session = null;
    sessionStorage.removeItem(STORAGE_KEY);
    if (roomId) clearRoomSession(roomId);
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
      if (data.lobby && (queueMode === 'tft' || session?.tft || data.tft)) {
        if (typeof data.isHost === 'boolean' && session) session.isHost = data.isHost;
        if (typeof data.playerId === 'number' && session) session.playerId = data.playerId;
        if (session) {
          session.lobby = data.lobby;
          saveSession(session);
        }
        updateLobbyUi(data.lobby, { isHost: data.isHost ?? session?.isHost, tft: true });
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
    clearLiveState();
    clearGameUrl();
    hideOnlineScreens();
    show($('menu-screen'));
    if (message) alert(message);
  }

  function handleMatchCancelled() {
    handleSessionExpired('Your opponent disconnected. Returning to menu.');
  }

  function sendLeaveBeacon() {
    // Refresh keeps the match alive via ?game= + session resume. Only leave
    // when the player intentionally exits (cancel / go home / cleanup).
    if (!hardLeaveOnUnload) return;
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

    if (msg.type === 'world' || msg.type === 'state') {
      if (deliverTftAuthState(msg.state)) return;
      if (msg.type === 'world') window.__TDG?.applyServerWorld?.(msg);
      return;
    }

    if (msg.type === 'forfeit') {
      if (window.TFT_ONLINE?.isActive?.()) {
        window.TFT_ONLINE.applyForfeit?.(msg.from);
        return;
      }
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
      if (title) title.textContent = '🃏 Draft Battle';
      if (desc) desc.textContent = 'Snake-draft 10 cards each, then fight online. Drafted cards still cost gold to unlock. Draft Battle players only match other Draft Battle players.';
    } else if (queueMode === 'tft') {
      if (title) title.textContent = '⚔️ TFT Online';
      if (desc) desc.textContent = 'Up to 4 players. Fill the lobby or start early with 2+. Each round alive players are paired — last standing wins.';
    } else {
      if (title) title.textContent = '🌐 Online PvP';
      if (desc) desc.textContent = 'Enter your name, join the queue, and battle a real opponent in Live Battle mode.';
    }
    const stored = loadStoredSession();
    const input = $('online-name-input');
    if (input && stored?.playerName) input.value = stored.playerName;
    input?.focus();
    fetchAccountDisplayName().then((accountName) => {
      if (!input || !accountName) return;
      // Prefer linked account name so wins land on the leaderboard.
      input.value = accountName;
      const hint = $('online-name-desc');
      if (hint && !hint.dataset.accountHint) {
        hint.dataset.accountHint = '1';
        hint.textContent = (hint.textContent || '') + ' Signed in — using your account display name.';
      }
    });
  }

  function showQueueScreen(name) {
    hide($('online-name-screen'));
    hide($('online-match-screen'));
    show($('online-queue-screen'));
    const label = $('online-queue-name');
    if (label) label.textContent = name;
    const title = $('online-queue-title');
    if (title) title.textContent = queueMode === 'tft' ? 'TFT lobby…' : 'Finding opponent…';
    updateLobbyUi(null);
  }

  function updateLobbyUi(lobby, opts = {}) {
    const meta = $('online-lobby-meta');
    const list = $('online-lobby-players');
    const countEl = $('online-lobby-count');
    const maxEl = $('online-lobby-max');
    const startBtn = $('btn-online-start-early');
    const isTft = queueMode === 'tft' || session?.tft || opts.tft;

    if (!isTft || !lobby) {
      meta?.classList.add('hidden');
      list?.classList.add('hidden');
      startBtn?.classList.add('hidden');
      if (list) list.innerHTML = '';
      return;
    }

    meta?.classList.remove('hidden');
    list?.classList.remove('hidden');
    if (countEl) countEl.textContent = String(lobby.count ?? lobby.players?.length ?? 0);
    if (maxEl) maxEl.textContent = String(lobby.max ?? 4);

    if (list) {
      const players = Array.isArray(lobby.players) ? lobby.players : [];
      const hostSlot = players.length ? Math.min(...players.map((x) => Number(x.slot))) : 0;
      list.innerHTML = players.map((p) => {
        const you = Number(p.slot) === Number(session?.playerId);
        const isHostSeat = Number(p.slot) === hostSlot;
        const tags = [you ? 'you' : null, isHostSeat ? 'host' : null].filter(Boolean).join(', ');
        return `<li style="padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.08)">${escapeLobbyHtml(p.name || 'Player')}${tags ? ` <span style="opacity:0.65">(${tags})</span>` : ''}</li>`;
      }).join('') || '<li style="opacity:0.7">Waiting for players…</li>';
    }

    const canStart = !!(lobby.canStartEarly && (opts.isHost ?? session?.isHost));
    if (startBtn) {
      startBtn.classList.toggle('hidden', !canStart);
      startBtn.disabled = !canStart;
      startBtn.textContent = `Start early (${lobby.count}/${lobby.max})`;
    }
  }

  function escapeLobbyHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  async function startLobbyEarly() {
    if (!session?.sessionToken || !session?.roomId) return;
    const btn = $('btn-online-start-early');
    if (btn) btn.disabled = true;
    try {
      const result = await fetchJson('/api/tdg-pvp/lobby-start', {
        method: 'POST',
        body: JSON.stringify({
          sessionToken: session.sessionToken,
          roomId: session.roomId,
        }),
      });
      if (result.status === 'matched') {
        handleMatchFound({
          ...result,
          sessionToken: session.sessionToken,
          playerName: result.playerName || session.playerName,
        });
      }
    } catch (err) {
      alert(err.message || 'Could not start lobby.');
      if (btn) btn.disabled = false;
    }
  }

  function showMatchScreen(youName, themName) {
    hide($('online-queue-screen'));
    hide($('online-name-screen'));
    show($('online-match-screen'));
    const you = $('online-you-name');
    const them = $('online-them-name');
    if (you) you.textContent = youName;
    if (them) them.textContent = themName || 'Lobby';
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
        playerName: session?.playerName || data.playerName || data.opponentName,
      });
    });
    playerChannel.bind('lobby_update', (data) => {
      if (!session) return;
      if (typeof data.playerId === 'number') session.playerId = data.playerId;
      if (typeof data.isHost === 'boolean') session.isHost = data.isHost;
      if (data.roomId) session.roomId = data.roomId;
      session.lobby = {
        roomId: data.roomId || session.roomId,
        count: data.count,
        max: data.max,
        minStart: data.minStart,
        canStartEarly: data.canStartEarly,
        players: data.players || [],
      };
      saveSession(session);
      updateLobbyUi(session.lobby, { isHost: session.isHost, tft: true });
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
      if (payload?.state?.mode === 'tft') {
        if (session?.isHost || session?.playerId === 0) {
          rememberTftAuthState(payload.state);
          return;
        }
        deliverTftAuthState(payload.state);
        return;
      }
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
      if (window.TFT_ONLINE?.isActive?.()) {
        window.TFT_ONLINE.applyForfeit?.(payload.from);
        return;
      }
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
    const resume = !!match.resume;

    const limited = Boolean(match.limited || queueMode === 'limited' || session?.limited);
    const tft = Boolean(match.tft || queueMode === 'tft' || session?.tft);
    const mode = tft ? 'tft' : (limited ? 'limited' : 'standard');
    queueMode = mode;

    if (match.roomId) setGameUrl(match.roomId, mode);

    hideOnlineScreens();
    hide($('menu-screen'));

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

    const startsAt = resume
      ? Date.now() + 800
      : (match.startsAt || Date.now() + 4000);

    const savedState = resume
      ? (match.serverState || loadLiveState(match.roomId, mode) || null)
      : null;

    function beginCombat(limitedPicks) {
      if (limitedPicks && session) {
        session.limitedPicks = limitedPicks;
        saveSession(session);
      }
      const picks = limitedPicks || session?.limitedPicks || savedState?.limitedPicks || null;
      runCountdown(resume ? Date.now() + 900 : Date.now() + 3200, () => {
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
          limitedPicks: picks,
          resume,
          savedState: (savedState && savedState.players) ? savedState : null,
        });
      });
    }

    if (limited && !resume) {
      window.__TDG.startLimitedDraftSession({
        myPlayerId: myId,
        player0Name: p0,
        player1Name: p1,
        onComplete: beginCombat,
      });
      return;
    }

    if (limited && resume) {
      if (savedState?.mode === 'limited_draft') {
        window.__TDG.startLimitedDraftSession({
          myPlayerId: myId,
          player0Name: p0,
          player1Name: p1,
          onComplete: beginCombat,
          resumeDraft: savedState,
        });
        return;
      }
      beginCombat(savedState?.limitedPicks || session?.limitedPicks || null);
      return;
    }

    if (tft) {
      // TFT lobbies use Pusher host sync (game WS is 1v1-only).
      match.serverAuth = false;
      const roster = Array.isArray(match.roster) && match.roster.length
        ? match.roster
        : (session?.roster || [
          { slot: 0, name: match.playerId === 0 ? match.playerName : 'P1' },
          { slot: 1, name: match.playerId === 1 ? match.playerName : (match.opponentName || 'P2') },
        ]);
      runCountdown(startsAt, () => {
        window.TFT_ONLINE?.start({
          myPlayerId: myId,
          isHost: match.isHost,
          roomId: match.roomId,
          roster,
          player0Name: roster.find((r) => r.slot === 0)?.name || match.playerName,
          player1Name: roster.find((r) => r.slot === 1)?.name || match.opponentName,
          resume,
          savedState: (savedState && savedState.mode === 'tft') ? savedState : null,
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
      roster: Array.isArray(data.roster) ? data.roster : (session?.roster || null),
      lobby: data.lobby || session?.lobby || null,
    };
    if (match.tft) match.serverAuth = false;
    saveSession(match);
    setGameUrl(match.roomId, modeFromSession(match));
    const themLabel = match.roster?.length > 2
      ? match.roster.filter((r) => r.slot !== match.playerId).map((r) => r.name).join(' · ')
      : match.opponentName;
    showMatchScreen(match.playerName, themLabel);
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
      lobby: result.lobby || null,
      roster: result.roster || null,
    });

    await ensurePusher();
    subscribeToPlayerChannel(result.sessionToken);
    startHeartbeat();

    if (result.status === 'matched') {
      setGameUrl(result.roomId, modeFromSession({
        limited: Boolean(result.limited || queueMode === 'limited'),
        tft: Boolean(result.tft || queueMode === 'tft'),
      }));
      const themLabel = result.roster?.length > 2
        ? result.roster.filter((r) => r.slot !== result.playerId).map((r) => r.name).join(' · ')
        : result.opponentName;
      showMatchScreen(result.playerName || name, themLabel);
      setTimeout(() => startOnlineMatch({
        ...result,
        playerName: result.playerName || name,
        limited: Boolean(result.limited || queueMode === 'limited'),
        tft: Boolean(result.tft || queueMode === 'tft'),
        serverAuth: false,
      }), 1400);
      return;
    }

    showQueueScreen(name);
    if (result.lobby) {
      updateLobbyUi(result.lobby, { isHost: result.isHost, tft: true });
    }
  }

  async function tryResumeFromUrl() {
    if (resumeInFlight) return false;
    const gameId = readGameIdFromUrl();
    if (!gameId) return false;

    const stored = loadStoredSession() || loadRoomSession(gameId);
    if (!stored?.sessionToken) return false;
    if (stored.reportedGameOver) {
      clearGameUrl();
      clearLiveState();
      clearRoomSession(gameId);
      return false;
    }
    if (stored.roomId && stored.roomId !== gameId) return false;

    const urlMode = readModeFromUrl();
    const sessionMode = modeFromSession(stored);
    queueMode = urlMode || sessionMode;
    resumeInFlight = true;
    hardLeaveOnUnload = false;

    try {
      hide($('menu-screen'));
      hideOnlineScreens();
      show($('online-match-screen'));
      const you = $('online-you-name');
      const them = $('online-them-name');
      if (you) you.textContent = stored.playerName || 'You';
      if (them) them.textContent = stored.opponentName || 'Opponent';

      const result = await fetchJson('/api/tdg-pvp/rejoin', {
        method: 'POST',
        body: JSON.stringify({
          roomId: gameId,
          sessionToken: stored.sessionToken,
          mode: queueMode,
        }),
      });

      const nextSession = {
        sessionToken: result.sessionToken,
        playerName: result.playerName || stored.playerName,
        roomId: result.roomId || gameId,
        playerId: result.playerId ?? stored.playerId,
        opponentName: result.opponentName || stored.opponentName,
        isHost: result.isHost ?? stored.isHost,
        status: result.status,
        startsAt: result.startsAt || Date.now() + 1000,
        joinTicket: result.joinTicket || null,
        serverAuth: result.serverAuth || false,
        authoritySlot: result.authoritySlot === 1 ? 1 : 0,
        limited: Boolean(result.limited || stored.limited || queueMode === 'limited'),
        tft: Boolean(result.tft || stored.tft || queueMode === 'tft'),
        limitedPicks: stored.limitedPicks || null,
      };
      saveSession(nextSession);

      // Prefer authoritative server snapshot for this room.
      if (result.state) {
        saveLiveState(result.state, {
          roomId: nextSession.roomId,
          mode: nextSession.tft ? 'tft' : (nextSession.limited ? 'limited' : 'standard'),
        });
      }

      await ensurePusher();
      subscribeToPlayerChannel(result.sessionToken);
      startHeartbeat();

      if (result.status === 'matched') {
        setGameUrl(result.roomId || gameId, modeFromSession(nextSession));
        await startOnlineMatch({
          ...result,
          roomId: result.roomId || gameId,
          playerName: result.playerName || stored.playerName,
          limited: nextSession.limited,
          tft: nextSession.tft,
          resume: true,
          serverState: result.state || null,
        });
        return true;
      }

      clearGameUrl();
      hideOnlineScreens();
      show($('menu-screen'));
      return false;
    } catch (err) {
      console.warn('Could not resume game from URL', err);
      clearGameUrl();
      hideOnlineScreens();
      show($('menu-screen'));
      return false;
    } finally {
      resumeInFlight = false;
    }
  }

  async function leaveQueue() {
    disconnecting = true;
    hardLeaveOnUnload = true;
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
    rememberTftAuthState(state);
    if (state && state.mode !== 'tft') {
      saveLiveState(state, {
        mode: state.mode === 'limited_draft'
          ? 'limited'
          : (state.mode === 'limited' || session.limited ? 'limited' : 'standard'),
      });
    }

    // Server-auth: designated authority publishes full world via WebSocket.
    if (session.serverAuth && gameSocket) {
      const authSlot = session.authoritySlot === 1 ? 1 : 0;
      if (session.playerId !== authSlot) return;
      socketSend({ type: 'state', state });
      // Always also persist over HTTP so ?game= rejoin has a server snapshot.
    } else if (!(session.isHost || session.playerId === 0)) {
      return;
    }

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
    hardLeaveOnUnload = true;
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
    clearLiveState();
    clearGameUrl();
    lastTftAuthState = null;
    pusher?.disconnect();
    pusher = null;
  }

  function goHome() {
    hardLeaveOnUnload = true;
    window.TFT_ONLINE?.cleanup?.(true);
    cleanup();
    hideOnlineScreens();
    show($('menu-screen'));
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
    $('btn-online-start-early')?.addEventListener('click', () => {
      void startLobbyEarly();
    });
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
      sendLeaveBeacon();
    });
    window.addEventListener('beforeunload', () => {
      sendLeaveBeacon();
    });

    void tryResumeFromUrl();
  }

  window.TDG_PVP = {
    sendAction,
    sendState,
    notifyGameOver,
    cleanup,
    goHome,
    leaveQueue,
    forfeitMatch,
    usesServerAuth: () => Boolean(session?.serverAuth && gameSocket),
    getLastTftAuthState: () => lastTftAuthState || loadLiveState(session?.roomId || readGameIdFromUrl(), 'tft'),
    getGameId: () => session?.roomId || readGameIdFromUrl() || null,
    persistLiveState: (state, meta) => saveLiveState(state, meta || {}),
  };

  bindUi();
})();
