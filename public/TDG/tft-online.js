/**
 * TFT Online — auto-battler for Block Fortress TDG.
 * Pointer drag-and-drop + live animated combat.
 */
(function () {
  'use strict';

  const COLS = 4;
  const ROWS = 4;
  const BENCH = 9;
  const SHOP = 5;
  const START_HP = 100;
  const START_GOLD = 10;
  const PLAN_SEC = 55;
  const REROLL = 2;
  const XP_COST = 4;
  const XP_PER_BUY = 4;
  const MAX_LEVEL = 8;
  const LEVEL_XP = [0, 2, 6, 10, 20, 36, 56, 80];
  const COMBAT_MAX_SEC = 32;
  const COMBAT_SPEED = 1.15;

  const UNIT_POOL = [
    'swordsman', 'bowman', 'striker', 'speed', 'goblin',
    'tank', 'farmer', 'sniper', 'wolf_hunter', 'yeti', 'angel', 'peka',
  ];

  const UNIT_COST = {
    swordsman: 1, bowman: 1, striker: 2, speed: 2, goblin: 2,
    tank: 3, farmer: 3, sniper: 3, wolf_hunter: 4, yeti: 4, angel: 4, peka: 5,
  };

  const UNIT_STATS = {
    swordsman: { name: 'Swordsman', hp: 68, damage: 20, attackRate: 0.85, range: 36, speed: 52, size: 20, color: '#e2e8f0' },
    bowman: { name: 'Archer', hp: 52, damage: 8, attackRate: 0.95, range: 110, speed: 52, size: 20, color: '#3f6212' },
    striker: { name: 'Knight', hp: 75, damage: 24, attackRate: 0.72, range: 34, speed: 70, size: 19, color: '#FF6B6B' },
    speed: { name: 'Wolf', hp: 58, damage: 17, attackRate: 1.2, range: 34, speed: 88, size: 18, color: '#F4F6FA' },
    goblin: { name: 'Goblin', hp: 48, damage: 14, attackRate: 1.15, range: 30, speed: 82, size: 14, color: '#4ade80' },
    tank: { name: 'Elephant', hp: 205, damage: 16, attackRate: 0.7, range: 36, speed: 42, size: 28, color: '#4ECDC4' },
    farmer: { name: 'Farmer', hp: 38, damage: 12, attackRate: 0.7, range: 32, speed: 40, size: 18, color: '#c4a574' },
    sniper: { name: 'Sniper', hp: 62, damage: 26, attackRate: 0.55, range: 140, speed: 34, size: 15, color: '#141414' },
    wolf_hunter: { name: 'Hunter', hp: 95, damage: 34, attackRate: 0.6, range: 48, speed: 48, size: 24, color: '#57534e' },
    yeti: { name: 'Yeti', hp: 280, damage: 28, attackRate: 0.75, range: 44, speed: 46, size: 28, color: '#9fd4ea' },
    angel: { name: 'Angel', hp: 210, damage: 22, attackRate: 0.8, range: 95, speed: 58, size: 23, color: '#facc15' },
    peka: { name: 'Dragon', hp: 420, damage: 40, attackRate: 0.5, range: 100, speed: 40, size: 36, color: '#b91c1c' },
  };

  const TRAITS = {
    warrior: { units: ['striker', 'swordsman', 'tank'], name: 'Warrior', breakpoints: [2, 4], hpPct: [0.15, 0.3] },
    hunter: { units: ['sniper', 'bowman', 'wolf_hunter'], name: 'Hunter', breakpoints: [2, 4], dmgPct: [0.15, 0.3] },
    beast: { units: ['speed', 'wolf_hunter', 'yeti'], name: 'Beast', breakpoints: [2, 3], atkSpdPct: [0.12, 0.25] },
    mystic: { units: ['angel', 'yeti', 'farmer'], name: 'Mystic', breakpoints: [2, 3], hpPct: [0.1, 0.2] },
  };

  let active = false;
  let match = null;
  let state = null;
  let canvas = null;
  let ctx = null;
  let raf = 0;
  let lastTs = 0;
  let portraitCache = {};
  let drag = null; // { from, type, ghost, pointerId }
  let uiBound = false;

  function $(id) { return document.getElementById(id); }

  function escapeHtml(t) {
    return String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  }

  function unitDef(type) {
    const bridge = window.__TDG?.getTftUnitDef?.(type) || {};
    const base = UNIT_STATS[type] || {};
    const labels = window.__TDG?.getTftUnitLabels?.() || {};
    return {
      type,
      name: labels[type] || base.name || bridge.name || type,
      hp: bridge.hp || base.hp || 80,
      damage: bridge.damage || base.damage || 12,
      attackRate: bridge.attackRate || base.attackRate || 0.8,
      range: Math.min(bridge.range || base.range || 40, 150),
      speed: Math.min(bridge.speed || base.speed || 50, 95),
      size: bridge.size || base.size || 18,
      color: bridge.color || base.color || '#94a3b8',
      cost: UNIT_COST[type] || 2,
    };
  }

  function mulberry32(a) {
    return function () {
      let t = (a += 0x6D2B79F5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashSeed(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function getPortrait(type) {
    if (portraitCache[type]) return portraitCache[type];
    const img = new Image();
    img.src = `/TDG/portraits/${type}.webp`;
    portraitCache[type] = img;
    return img;
  }

  function freshPlayer(pid, name) {
    return {
      id: pid,
      name,
      hp: START_HP,
      gold: START_GOLD,
      level: 1,
      xp: 0,
      winStreak: 0,
      lossStreak: 0,
      shop: [],
      bench: Array(BENCH).fill(null),
      board: Array.from({ length: ROWS }, () => Array(COLS).fill(null)),
      ready: false,
      traits: {},
    };
  }

  function me() { return state.players[match.playerId]; }
  function opp() { return state.players[1 - match.playerId]; }

  function boardCap(p) {
    return Math.min(MAX_LEVEL, Math.max(1, p.level));
  }

  function boardCount(p) {
    let n = 0;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (p.board[r][c]) n++;
    return n;
  }

  function getUnitAt(p, ref) {
    if (!ref) return null;
    if (ref.area === 'bench') return p.bench[ref.idx] || null;
    if (ref.area === 'board') return p.board[ref.r]?.[ref.c] || null;
    return null;
  }

  function setUnitAt(p, ref, unit) {
    if (ref.area === 'bench') p.bench[ref.idx] = unit;
    else p.board[ref.r][ref.c] = unit;
  }

  function sameRef(a, b) {
    if (!a || !b || a.area !== b.area) return false;
    if (a.area === 'bench') return a.idx === b.idx;
    return a.r === b.r && a.c === b.c;
  }

  function rollShop(p) {
    const seed = hashSeed(`${match.roomId}|r${state.round}|p${p.id}|shop`);
    const rng = mulberry32(seed);
    const shop = [];
    for (let i = 0; i < SHOP; i++) {
      let pool = UNIT_POOL.filter((u) => {
        const c = UNIT_COST[u] || 3;
        if (p.level <= 2) return c <= 2;
        if (p.level <= 4) return c <= 3;
        if (p.level <= 6) return c <= 4;
        return true;
      });
      if (!pool.length) pool = UNIT_POOL.slice();
      shop.push(pool[Math.floor(rng() * pool.length)]);
    }
    p.shop = shop;
  }

  function incomeFor(p) {
    let base = 5 + Math.min(8, state.round);
    base += Math.min(5, Math.floor(p.gold / 10));
    if (p.winStreak >= 2) base += Math.min(3, p.winStreak - 1);
    if (p.lossStreak >= 2) base += 1;
    return base;
  }

  function pushMsg(text) {
    state.messages.unshift(text);
    state.messages = state.messages.slice(0, 10);
    const el = $('tft-log');
    if (el) el.innerHTML = state.messages.map((m) => `<div class="tft-log-line">${escapeHtml(m)}</div>`).join('');
  }

  function broadcastAction(action) {
    window.TDG_PVP?.sendAction?.(action);
  }

  function traitCounts(p) {
    const counts = {};
    const units = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const u = p.board[r][c];
        if (u) units.push(u.type);
      }
    }
    for (const [tid, tr] of Object.entries(TRAITS)) {
      counts[tid] = units.filter((t) => tr.units.includes(t)).length;
    }
    p.traits = counts;
    return counts;
  }

  function applyTraits(stats, counts) {
    const out = { ...stats };
    for (const [tid, tr] of Object.entries(TRAITS)) {
      const n = counts[tid] || 0;
      let tier = -1;
      for (let i = tr.breakpoints.length - 1; i >= 0; i--) {
        if (n >= tr.breakpoints[i]) { tier = i; break; }
      }
      if (tier < 0) continue;
      if (tr.hpPct) out.hp = Math.round(out.hp * (1 + tr.hpPct[tier]));
      if (tr.dmgPct) out.damage = Math.round(out.damage * (1 + tr.dmgPct[tier]));
      if (tr.atkSpdPct) out.attackRate = out.attackRate * (1 + tr.atkSpdPct[tier]);
    }
    return out;
  }

  function arenaLayout() {
    const w = canvas?.width || 720;
    const h = canvas?.height || 360;
    const padX = Math.max(36, w * 0.06);
    const padY = Math.max(42, h * 0.12);
    const mid = w / 2;
    const cellW = Math.min(78, (mid - padX - 20) / COLS);
    const cellH = Math.min(70, (h - padY * 2) / ROWS);
    return { w, h, padX, padY, mid, cellW, cellH };
  }

  function boardCellPos(pid, r, c, layout) {
    const { padX, padY, mid, cellW, cellH, w } = layout;
    if (pid === 0) {
      return {
        x: padX + c * cellW + cellW * 0.5,
        y: padY + r * cellH + cellH * 0.5,
      };
    }
    return {
      x: w - padX - (COLS - 1 - c) * cellW - cellW * 0.5,
      y: padY + r * cellH + cellH * 0.5,
    };
  }

  function spawnCombatUnits() {
    const layout = arenaLayout();
    const units = [];
    const traits = [traitCounts(state.players[0]), traitCounts(state.players[1])];
    for (let pid = 0; pid < 2; pid++) {
      const p = state.players[pid];
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const cell = p.board[r][c];
          if (!cell) continue;
          const def = unitDef(cell.type);
          const st = applyTraits(def, traits[pid]);
          const pos = boardCellPos(pid, r, c, layout);
          units.push({
            uid: `${pid}-${r}-${c}-${cell.type}`,
            owner: pid,
            type: cell.type,
            name: def.name,
            hp: st.hp,
            maxHp: st.hp,
            damage: st.damage,
            attackRate: st.attackRate,
            range: st.range,
            speed: st.speed * 1.35,
            size: Math.max(16, Math.min(34, def.size * 0.9)),
            color: def.color,
            x: pos.x,
            y: pos.y,
            homeX: pos.x,
            homeY: pos.y,
            attackCd: 0.15 + (r + c) * 0.04,
            attackFlash: 0,
            hitFlash: 0,
            targetUid: null,
            alive: true,
            deathT: 0,
          });
        }
      }
    }
    state.combatUnits = units;
    state.projectiles = [];
    state.floatTexts = [];
    state.combatElapsed = 0;
    state.combatFinished = false;
    state.pendingResult = null;
  }

  function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function findUnit(uid) {
    return state.combatUnits.find((u) => u.uid === uid) || null;
  }

  function computeResultFromField() {
    const rem0 = state.combatUnits.filter((u) => u.alive && u.owner === 0);
    const rem1 = state.combatUnits.filter((u) => u.alive && u.owner === 1);
    const seed = state.combatSeed || hashSeed(`${match.roomId}|combat|${state.round}`);
    const rng = mulberry32(seed ^ 0xC0FFEE);
    let winner;
    if (rem0.length && !rem1.length) winner = 0;
    else if (rem1.length && !rem0.length) winner = 1;
    else if (rem0.length !== rem1.length) winner = rem0.length > rem1.length ? 0 : 1;
    else {
      const hp0 = rem0.reduce((s, u) => s + u.hp, 0);
      const hp1 = rem1.reduce((s, u) => s + u.hp, 0);
      if (hp0 !== hp1) winner = hp0 > hp1 ? 0 : 1;
      else winner = rng() < 0.5 ? 0 : 1;
    }
    const survivors = winner === 0 ? rem0.length : rem1.length;
    const damage = Math.max(3, Math.min(18, survivors * 2 + Math.ceil(state.round * 0.8)));
    return { winner, damage, rem0: rem0.length, rem1: rem1.length };
  }

  function addFloat(x, y, text, color) {
    state.floatTexts.push({ x, y, text, color, life: 0.85 });
  }

  function tickCombat(dt) {
    if (state.phase !== 'combat' || state.combatFinished) return;
    const step = dt * COMBAT_SPEED;
    state.combatElapsed += step;

    for (const u of state.combatUnits) {
      if (!u.alive) {
        u.deathT = Math.min(1, u.deathT + step * 1.6);
        continue;
      }
      u.attackFlash = Math.max(0, u.attackFlash - step * 4);
      u.hitFlash = Math.max(0, u.hitFlash - step * 5);
      u.attackCd = Math.max(0, u.attackCd - step);

      const foes = state.combatUnits.filter((x) => x.alive && x.owner !== u.owner);
      if (!foes.length) continue;

      let best = foes[0];
      let bestD = dist(u, best);
      for (const f of foes) {
        const d = dist(u, f);
        if (d < bestD) { best = f; bestD = d; }
      }
      u.targetUid = best.uid;

      const stopRange = Math.max(22, u.range * 0.92);
      if (bestD <= stopRange) {
        if (u.attackCd <= 0) {
          u.attackCd = 1 / Math.max(0.25, u.attackRate);
          u.attackFlash = 1;
          const ranged = u.range >= 70;
          if (ranged) {
            state.projectiles.push({
              x: u.x,
              y: u.y - 6,
              tx: best.x,
              ty: best.y - 4,
              from: u.uid,
              to: best.uid,
              damage: u.damage,
              color: u.color,
              life: 0.28,
              maxLife: 0.28,
            });
          } else {
            best.hp -= u.damage;
            best.hitFlash = 1;
            addFloat(best.x, best.y - best.size, `-${u.damage}`, '#ffb4a2');
            if (best.hp <= 0) {
              best.alive = false;
              best.deathT = 0;
              addFloat(best.x, best.y - 8, 'KO', '#f0d878');
            }
          }
        }
      } else {
        const dx = best.x - u.x;
        const dy = best.y - u.y;
        const mag = Math.hypot(dx, dy) || 1;
        u.x += (dx / mag) * u.speed * step;
        u.y += (dy / mag) * u.speed * step;
      }
    }

    for (let i = state.projectiles.length - 1; i >= 0; i--) {
      const p = state.projectiles[i];
      p.life -= step;
      const t = 1 - Math.max(0, p.life) / p.maxLife;
      p.x = p.x + (p.tx - p.x) * Math.min(1, step * 8);
      p.y = p.y + (p.ty - p.y) * Math.min(1, step * 8);
      if (t >= 0.92 || p.life <= 0) {
        const target = findUnit(p.to);
        if (target?.alive) {
          target.hp -= p.damage;
          target.hitFlash = 1;
          addFloat(target.x, target.y - target.size, `-${p.damage}`, '#7dd3fc');
          if (target.hp <= 0) {
            target.alive = false;
            target.deathT = 0;
            addFloat(target.x, target.y - 8, 'KO', '#f0d878');
          }
        }
        state.projectiles.splice(i, 1);
      }
    }

    for (let i = state.floatTexts.length - 1; i >= 0; i--) {
      const f = state.floatTexts[i];
      f.life -= step;
      f.y -= 28 * step;
      if (f.life <= 0) state.floatTexts.splice(i, 1);
    }

    const alive0 = state.combatUnits.some((u) => u.alive && u.owner === 0);
    const alive1 = state.combatUnits.some((u) => u.alive && u.owner === 1);
    if (!alive0 || !alive1 || state.combatElapsed >= COMBAT_MAX_SEC) {
      finishLiveCombat();
    }
  }

  function finishLiveCombat() {
    if (state.combatFinished) return;
    state.combatFinished = true;
    const result = computeResultFromField();
    state.pendingResult = result;
    if (match.isHost) {
      broadcastAction({ type: 'tft_combat_result', result });
    }
    setTimeout(() => applyCombatResult(result), 900);
  }

  function applyCombatResult(result) {
    if (!result || !state) return;
    if (state.phase !== 'combat' && state.phase !== 'result') return;
    if (state.resultApplied) return;
    state.resultApplied = true;
    const loser = result.winner === 0 ? 1 : 0;
    const win = result.winner;
    state.players[loser].hp = Math.max(0, state.players[loser].hp - result.damage);
    state.players[win].winStreak += 1;
    state.players[win].lossStreak = 0;
    state.players[loser].lossStreak += 1;
    state.players[loser].winStreak = 0;
    state.lastCombat = result;
    state.phase = 'result';
    state.resultTimer = 3.5;
    pushMsg(`${state.players[win].name} wins! ${state.players[loser].name} −${result.damage} HP (${state.players[loser].hp} left)`);
    setShellMode('result');
    renderHud();
    if (state.players[0].hp <= 0 || state.players[1].hp <= 0) {
      endMatch(state.players[0].hp <= 0 ? 1 : 0);
    }
  }

  function beginCombat(opts = {}) {
    if (state.phase !== 'planning' && !opts.force) return;
    endDrag(true);
    state.phase = 'combat';
    state.resultApplied = false;
    state.combatSeed = opts.seed || hashSeed(`${match.roomId}|combat|${state.round}`);
    spawnCombatUnits();
    pushMsg('Battle!');
    setShellMode('combat');
    renderHud();
    if (match.isHost && !opts.fromRemote) {
      broadcastAction({
        type: 'tft_combat_start',
        seed: state.combatSeed,
        boards: [
          serializeBoard(state.players[0]),
          serializeBoard(state.players[1]),
        ],
      });
    }
  }

  function serializeBoard(p) {
    const board = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const u = p.board[r][c];
        if (u) board.push({ r, c, type: u.type, id: u.id });
      }
    }
    return board;
  }

  function applyBoardSnapshot(pid, cells) {
    const p = state.players[pid];
    p.board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    for (const cell of cells || []) {
      p.board[cell.r][cell.c] = { type: cell.type, id: cell.id || `${pid}-${cell.r}-${cell.c}` };
    }
  }

  function startRound() {
    state.phase = 'planning';
    state.planningLeft = PLAN_SEC;
    state.combatUnits = [];
    state.projectiles = [];
    state.floatTexts = [];
    state.combatFinished = false;
    state.resultApplied = false;
    state.pendingResult = null;
    for (const p of state.players) {
      p.ready = false;
      p.gold += incomeFor(p);
      rollShop(p);
    }
    pushMsg(`Round ${state.round} — build your board (${PLAN_SEC}s)`);
    setShellMode('planning');
    renderHud();
  }

  function endMatch(winnerSlot) {
    state.phase = 'gameover';
    setShellMode('gameover');
    pushMsg(winnerSlot === match.playerId ? 'Victory!' : 'Defeat');
    renderHud();
    window.TDG_PVP?.notifyGameOver?.({
      winnerSlot,
      endReason: 'base_destroyed',
    });
    setTimeout(() => {
      cleanup();
      $('tft-game-screen')?.classList.add('hidden');
      $('menu-screen')?.classList.remove('hidden');
      if (typeof phase !== 'undefined') phase = 'menu';
      if (typeof gameMode !== 'undefined') gameMode = null;
    }, 3600);
  }

  function setShellMode(mode) {
    const shell = document.querySelector('#tft-game-screen .tft-shell');
    if (!shell) return;
    shell.classList.toggle('is-combat', mode === 'combat');
    shell.classList.toggle('is-planning', mode === 'planning');
    shell.classList.toggle('is-result', mode === 'result' || mode === 'gameover');
  }

  // ─── Shop / board actions ──────────────────────────────────────────────────

  function tryBuy(shopIdx) {
    const p = me();
    if (state.phase !== 'planning' || p.ready) return false;
    const type = p.shop[shopIdx];
    if (!type) return false;
    const cost = UNIT_COST[type] || 2;
    if (p.gold < cost) return false;
    const slot = p.bench.findIndex((x) => !x);
    if (slot < 0) {
      pushMsg('Bench full — sell or place a unit first.');
      return false;
    }
    p.gold -= cost;
    p.bench[slot] = { type, id: `${Date.now()}-${slot}` };
    p.shop[shopIdx] = null;
    broadcastAction({ type: 'tft_buy', shopIdx, playerId: match.playerId });
    renderHud();
    return true;
  }

  function trySell(ref) {
    const p = me();
    if (state.phase !== 'planning' || p.ready) return false;
    const unit = getUnitAt(p, ref);
    if (!unit) return false;
    setUnitAt(p, ref, null);
    p.gold += Math.max(1, Math.floor((UNIT_COST[unit.type] || 2) * 0.8));
    broadcastAction({
      type: 'tft_sell',
      ref: ref.area === 'bench'
        ? { from: 'bench', idx: ref.idx }
        : { from: 'board', r: ref.r, c: ref.c },
      playerId: match.playerId,
    });
    renderHud();
    return true;
  }

  function tryMoveOrSwap(from, to) {
    const p = me();
    if (state.phase !== 'planning' || p.ready) return false;
    if (!from || !to || sameRef(from, to)) return false;
    const moving = getUnitAt(p, from);
    if (!moving) return false;
    const dest = getUnitAt(p, to);

    if (to.area === 'board' && from.area === 'bench' && !dest) {
      if (boardCount(p) >= boardCap(p)) {
        pushMsg(`Board full (${boardCap(p)}). Level up for more slots.`);
        return false;
      }
    }

    if (dest) {
      // swap
      setUnitAt(p, from, dest);
      setUnitAt(p, to, moving);
    } else {
      setUnitAt(p, to, moving);
      setUnitAt(p, from, null);
    }

    broadcastAction({ type: 'tft_move', from, to, playerId: match.playerId, swap: !!dest });
    renderHud();
    return true;
  }

  function tryReroll() {
    const p = me();
    if (state.phase !== 'planning' || p.ready || p.gold < REROLL) return false;
    p.gold -= REROLL;
    rollShop(p);
    broadcastAction({ type: 'tft_reroll', playerId: match.playerId });
    renderHud();
    return true;
  }

  function tryBuyXp() {
    const p = me();
    if (state.phase !== 'planning' || p.ready || p.gold < XP_COST || p.level >= MAX_LEVEL) return false;
    p.gold -= XP_COST;
    p.xp += XP_PER_BUY;
    while (p.level < MAX_LEVEL && p.xp >= (LEVEL_XP[p.level] || 999)) {
      p.xp -= LEVEL_XP[p.level] || 0;
      p.level += 1;
      pushMsg(`${p.name} reached level ${p.level}!`);
    }
    broadcastAction({ type: 'tft_buy_xp', playerId: match.playerId });
    renderHud();
    return true;
  }

  function setReady(val) {
    const p = me();
    if (state.phase !== 'planning') return;
    p.ready = val;
    broadcastAction({ type: 'tft_ready', ready: val, playerId: match.playerId });
    renderHud();
    checkPlanningEnd();
  }

  function checkPlanningEnd() {
    if (state.phase !== 'planning') return;
    if (state.players[0].ready && state.players[1].ready) beginCombat();
  }

  function applyMoveOnPlayer(p, from, to, swap) {
    const moving = getUnitAt(p, from);
    if (!moving) return;
    const dest = getUnitAt(p, to);
    if (dest || swap) {
      setUnitAt(p, from, dest || null);
      setUnitAt(p, to, moving);
      return;
    }
    if (to.area === 'board' && from.area === 'bench' && boardCount(p) >= boardCap(p)) return;
    setUnitAt(p, to, moving);
    setUnitAt(p, from, null);
  }

  function applyRemoteAction(fromPlayerId, action) {
    if (!state || !action?.type) return false;
    const p = state.players[fromPlayerId];
    if (!p && !String(action.type).startsWith('tft_combat')) return false;

    switch (action.type) {
      case 'tft_buy': {
        const type = p.shop[action.shopIdx];
        if (!type) return true;
        const cost = UNIT_COST[type] || 2;
        const slot = p.bench.findIndex((x) => !x);
        if (slot < 0 || p.gold < cost) return true;
        p.gold -= cost;
        p.bench[slot] = { type, id: `${fromPlayerId}-${slot}` };
        p.shop[action.shopIdx] = null;
        renderHud();
        return true;
      }
      case 'tft_sell': {
        const ref = action.ref;
        const sellRef = ref.from === 'bench' || ref.area === 'bench'
          ? { area: 'bench', idx: ref.idx }
          : { area: 'board', r: ref.r, c: ref.c };
        const unit = getUnitAt(p, sellRef);
        if (!unit) return true;
        setUnitAt(p, sellRef, null);
        p.gold += Math.max(1, Math.floor((UNIT_COST[unit.type] || 2) * 0.8));
        renderHud();
        return true;
      }
      case 'tft_move':
        applyMoveOnPlayer(p, action.from, action.to, action.swap);
        renderHud();
        return true;
      case 'tft_reroll':
        if (p.gold >= REROLL) { p.gold -= REROLL; rollShop(p); }
        renderHud();
        return true;
      case 'tft_buy_xp':
        if (p.gold >= XP_COST && p.level < MAX_LEVEL) {
          p.gold -= XP_COST;
          p.xp += XP_PER_BUY;
          while (p.level < MAX_LEVEL && p.xp >= (LEVEL_XP[p.level] || 999)) {
            p.xp -= LEVEL_XP[p.level] || 0;
            p.level += 1;
          }
        }
        renderHud();
        return true;
      case 'tft_ready':
        p.ready = !!action.ready;
        renderHud();
        checkPlanningEnd();
        return true;
      case 'tft_combat_start':
        if (state.phase === 'planning') {
          if (action.boards?.[0]) applyBoardSnapshot(0, action.boards[0]);
          if (action.boards?.[1]) applyBoardSnapshot(1, action.boards[1]);
          beginCombat({ seed: action.seed, fromRemote: true, force: true });
        }
        return true;
      case 'tft_combat_result':
        if (state.phase === 'planning') {
          beginCombat({ force: true, fromRemote: true });
        }
        if (!match.isHost) {
          // Prefer live local finish; only force if combat already ended differently
          if (state.combatFinished || state.phase === 'combat') {
            setTimeout(() => applyCombatResult(action.result), state.combatFinished ? 200 : 400);
          }
        }
        return true;
      default:
        return false;
    }
  }

  // ─── Drag and drop ─────────────────────────────────────────────────────────

  function parseDropTarget(el) {
    if (!el) return null;
    if (el.id === 'tft-sell-zone' || el.closest?.('#tft-sell-zone')) return { area: 'sell' };
    const board = el.closest?.('.tft-board-cell');
    if (board) return { area: 'board', r: Number(board.dataset.r), c: Number(board.dataset.c) };
    const bench = el.closest?.('[data-bench]');
    if (bench && bench.hasAttribute('data-bench')) {
      return { area: 'bench', idx: Number(bench.getAttribute('data-bench')) };
    }
    return null;
  }

  function clearDropHighlights() {
    document.querySelectorAll('.tft-drop-ok, .tft-drop-bad, .tft-dragging-source').forEach((el) => {
      el.classList.remove('tft-drop-ok', 'tft-drop-bad', 'tft-dragging-source');
    });
  }

  function highlightDrops(from) {
    clearDropHighlights();
    const p = me();
    document.querySelectorAll('.tft-board-cell').forEach((cell) => {
      const r = Number(cell.dataset.r);
      const c = Number(cell.dataset.c);
      const occupied = !!p.board[r][c];
      const placingNew = from.area === 'bench' && !occupied;
      const overCap = placingNew && boardCount(p) >= boardCap(p);
      cell.classList.add(overCap ? 'tft-drop-bad' : 'tft-drop-ok');
    });
    document.querySelectorAll('#tft-bench [data-bench]').forEach((slot) => {
      slot.classList.add('tft-drop-ok');
    });
    $('tft-sell-zone')?.classList.add('tft-drop-ok');
  }

  function markSource(from) {
    clearDropHighlights();
    if (from.area === 'bench') {
      document.querySelector(`#tft-bench [data-bench="${from.idx}"]`)?.classList.add('tft-dragging-source');
    } else {
      document.querySelector(`.tft-board-cell[data-r="${from.r}"][data-c="${from.c}"]`)?.classList.add('tft-dragging-source');
    }
    highlightDrops(from);
  }

  function createGhost(type, x, y) {
    const ghost = document.createElement('div');
    ghost.className = 'tft-drag-ghost';
    ghost.innerHTML = `<img src="/TDG/portraits/${type}.webp" alt="" /><span>${escapeHtml(unitDef(type).name)}</span>`;
    ghost.style.left = `${x}px`;
    ghost.style.top = `${y}px`;
    document.body.appendChild(ghost);
    return ghost;
  }

  function moveGhost(x, y) {
    if (!drag?.ghost) return;
    drag.ghost.style.left = `${x}px`;
    drag.ghost.style.top = `${y}px`;
  }

  function endDrag(cancel) {
    if (!drag) return;
    const from = drag.from;
    const pointerId = drag.pointerId;
    drag.ghost?.remove();
    const under = drag.lastEl || null;
    drag = null;
    clearDropHighlights();
    document.body.classList.remove('tft-is-dragging');
    if (cancel) return;
    const to = parseDropTarget(under);
    if (!to) return;
    if (to.area === 'sell') {
      trySell(from);
      return;
    }
    tryMoveOrSwap(from, to);
  }

  function startDrag(from, type, e) {
    if (state.phase !== 'planning' || me().ready) return;
    if (drag) endDrag(true);
    drag = {
      from,
      type,
      ghost: createGhost(type, e.clientX, e.clientY),
      pointerId: e.pointerId,
      lastEl: null,
    };
    document.body.classList.add('tft-is-dragging');
    markSource(from);
    try { e.target.setPointerCapture?.(e.pointerId); } catch { /* ignore */ }
  }

  function onPointerDown(e) {
    if (!active || state?.phase !== 'planning' || me().ready) return;
    if (e.button !== undefined && e.button !== 0) return;
    const board = e.target.closest?.('.tft-board-cell');
    if (board?.querySelector('img')) {
      const r = Number(board.dataset.r);
      const c = Number(board.dataset.c);
      const unit = me().board[r][c];
      if (!unit) return;
      e.preventDefault();
      startDrag({ area: 'board', r, c }, unit.type, e);
      return;
    }
    const bench = e.target.closest?.('#tft-bench [data-bench]');
    if (bench?.querySelector('img')) {
      const idx = Number(bench.getAttribute('data-bench'));
      const unit = me().bench[idx];
      if (!unit) return;
      e.preventDefault();
      startDrag({ area: 'bench', idx }, unit.type, e);
    }
  }

  function onPointerMove(e) {
    if (!drag || (drag.pointerId != null && e.pointerId !== drag.pointerId)) return;
    moveGhost(e.clientX, e.clientY);
    drag.lastEl = document.elementFromPoint(e.clientX, e.clientY);
  }

  function onPointerUp(e) {
    if (!drag) return;
    if (drag.pointerId != null && e.pointerId !== drag.pointerId) return;
    drag.lastEl = document.elementFromPoint(e.clientX, e.clientY) || drag.lastEl;
    endDrag(false);
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  function unitChipHtml(unit, extra = '') {
    if (!unit) return '';
    const def = unitDef(unit.type);
    return `<div class="tft-unit-chip ${extra}" data-type="${unit.type}">`
      + `<img src="/TDG/portraits/${unit.type}.webp" alt="" draggable="false" />`
      + `<span class="tft-unit-cost">${def.cost}</span>`
      + `</div>`;
  }

  function renderHud() {
    if (!state) return;
    const p = me();
    const o = opp();
    const planning = state.phase === 'planning';

    const setText = (id, text) => { const el = $(id); if (el) el.textContent = text; };
    setText('tft-round-label', `Round ${state.round}`);
    setText('tft-phase-label',
      planning ? `Planning · ${Math.ceil(state.planningLeft)}s`
        : state.phase === 'combat' ? `Fighting · ${Math.ceil(state.combatElapsed || 0)}s`
          : state.phase === 'result' ? 'Round result'
            : state.phase === 'gameover' ? 'Game Over' : state.phase);
    setText('tft-you-hp', String(p.hp));
    setText('tft-them-hp', String(o.hp));
    setText('tft-gold', String(p.gold));
    setText('tft-level', `Lv ${p.level} (${p.xp}/${LEVEL_XP[p.level] ?? 'MAX'})`);
    setText('tft-board-cap', `${boardCount(p)}/${boardCap(p)}`);
    setText('tft-you-name', p.name);
    setText('tft-them-name', o.name);
    setText('tft-them-ready', o.ready ? 'Ready ✓' : 'Shopping…');
    setText('tft-income-preview', planning ? `Next income ~${incomeFor(p)}g` : '');

    const shopEl = $('tft-shop');
    if (shopEl) {
      shopEl.innerHTML = p.shop.map((type, i) => {
        if (!type) {
          return `<div class="tft-shop-card is-empty" aria-hidden="true"></div>`;
        }
        const def = unitDef(type);
        const cost = UNIT_COST[type] || 2;
        const afford = p.gold >= cost && p.bench.some((x) => !x);
        return `<button type="button" class="tft-shop-card${afford ? '' : ' is-disabled'}" data-shop="${i}" ${afford && planning && !p.ready ? '' : 'disabled'}>`
          + `<img src="/TDG/portraits/${type}.webp" alt="" draggable="false" />`
          + `<span class="tft-shop-name">${escapeHtml(def.name)}</span>`
          + `<span class="tft-shop-cost">${cost}g</span></button>`;
      }).join('');
    }

    const boardEl = $('tft-board');
    if (boardEl) {
      let html = '';
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const u = p.board[r][c];
          html += `<div class="tft-board-cell${u ? ' has-unit' : ''}" data-r="${r}" data-c="${c}">`;
          if (u) html += unitChipHtml(u);
          html += '</div>';
        }
      }
      boardEl.innerHTML = html;
    }

    const oppBoard = $('tft-opp-board');
    if (oppBoard) {
      let html = '';
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const u = o.board[r][c];
          html += `<div class="tft-board-cell is-opp${u ? ' has-unit' : ''}">`;
          if (u) html += unitChipHtml(u, 'is-opp');
          html += '</div>';
        }
      }
      oppBoard.innerHTML = html;
    }

    const benchEl = $('tft-bench');
    if (benchEl) {
      benchEl.innerHTML = p.bench.map((u, i) => (
        `<div class="tft-bench-slot${u ? ' has-unit' : ''}" data-bench="${i}">${u ? unitChipHtml(u) : ''}</div>`
      )).join('');
    }

    const traitsEl = $('tft-traits');
    if (traitsEl) {
      const counts = traitCounts(p);
      traitsEl.innerHTML = Object.entries(TRAITS).map(([id, tr]) => {
        const n = counts[id] || 0;
        const activeTrait = n >= tr.breakpoints[0];
        const next = tr.breakpoints.find((b) => n < b) || tr.breakpoints[tr.breakpoints.length - 1];
        return `<span class="tft-trait${activeTrait ? ' is-active' : ''}" title="${tr.name}">${tr.name} ${n}/${next}</span>`;
      }).join('');
    }

    const readyBtn = $('tft-ready-btn');
    if (readyBtn) {
      readyBtn.disabled = !planning;
      readyBtn.textContent = p.ready ? 'Waiting…' : 'Ready';
      readyBtn.classList.toggle('is-waiting', p.ready);
    }
    $('tft-reroll-btn') && ($('tft-reroll-btn').disabled = !planning || p.ready || p.gold < REROLL);
    $('tft-xp-btn') && ($('tft-xp-btn').disabled = !planning || p.ready || p.gold < XP_COST || p.level >= MAX_LEVEL);
  }

  function drawCombat() {
    if (!ctx || !canvas) return;
    const layout = arenaLayout();
    const { w, h, mid } = layout;

    ctx.clearRect(0, 0, w, h);
    // Arena backdrop
    const grd = ctx.createLinearGradient(0, 0, w, 0);
    grd.addColorStop(0, '#143028');
    grd.addColorStop(0.5, '#0f1410');
    grd.addColorStop(1, '#301018');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = 'rgba(78,205,196,0.08)';
    ctx.fillRect(0, 0, mid, h);
    ctx.fillStyle = 'rgba(255,142,83,0.08)';
    ctx.fillRect(mid, 0, mid, h);

    ctx.strokeStyle = 'rgba(240,216,120,0.35)';
    ctx.setLineDash([6, 8]);
    ctx.beginPath();
    ctx.moveTo(mid, 16);
    ctx.lineTo(mid, h - 16);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.font = '700 13px Rajdhani, sans-serif';
    ctx.fillStyle = '#4ECDC4';
    ctx.textAlign = 'left';
    ctx.fillText(state.players[0].name, 16, 22);
    ctx.fillStyle = '#FF8E53';
    ctx.textAlign = 'right';
    ctx.fillText(state.players[1].name, w - 16, 22);
    ctx.textAlign = 'left';

    // Sort by y for simple depth
    const drawList = state.combatUnits.slice().sort((a, b) => a.y - b.y);
    for (const u of drawList) {
      const alpha = u.alive ? 1 : Math.max(0, 1 - u.deathT);
      if (alpha <= 0.02) continue;
      ctx.save();
      ctx.globalAlpha = alpha;
      const scale = u.alive ? 1 + u.attackFlash * 0.08 : 1 - u.deathT * 0.35;
      const rad = u.size * 0.55 * scale;

      // shadow
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(u.x, u.y + rad * 0.7, rad * 0.7, rad * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();

      const img = getPortrait(u.type);
      if (img.complete && img.naturalWidth) {
        ctx.save();
        if (u.hitFlash > 0) ctx.filter = 'brightness(1.8)';
        ctx.beginPath();
        ctx.arc(u.x, u.y, rad, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(img, u.x - rad, u.y - rad, rad * 2, rad * 2);
        ctx.restore();
        ctx.strokeStyle = u.owner === 0 ? '#4ECDC4' : '#FF8E53';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(u.x, u.y, rad, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = u.color;
        ctx.beginPath();
        ctx.arc(u.x, u.y, rad, 0, Math.PI * 2);
        ctx.fill();
      }

      if (u.attackFlash > 0.2 && u.targetUid) {
        const t = findUnit(u.targetUid);
        if (t) {
          ctx.strokeStyle = `rgba(255,255,255,${u.attackFlash * 0.55})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(u.x, u.y);
          ctx.lineTo(t.x, t.y);
          ctx.stroke();
        }
      }

      // HP bar
      if (u.alive) {
        const bw = Math.max(28, rad * 2);
        const bh = 5;
        const bx = u.x - bw / 2;
        const by = u.y - rad - 12;
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.fillRect(bx, by, bw, bh);
        ctx.fillStyle = u.owner === 0 ? '#4ECDC4' : '#FF8E53';
        ctx.fillRect(bx, by, bw * Math.max(0, u.hp / u.maxHp), bh);
      }
      ctx.restore();
    }

    for (const p of state.projectiles) {
      ctx.fillStyle = p.color || '#fff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.stroke();
    }

    for (const f of state.floatTexts) {
      ctx.globalAlpha = Math.max(0, f.life);
      ctx.fillStyle = f.color || '#fff';
      ctx.font = '700 14px Orbitron, Rajdhani, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(f.text, f.x, f.y);
      ctx.globalAlpha = 1;
      ctx.textAlign = 'left';
    }

    if (state.combatFinished && state.pendingResult) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0, h * 0.38, w, 48);
      ctx.fillStyle = '#f0d878';
      ctx.font = '700 22px Orbitron, Rajdhani, sans-serif';
      ctx.textAlign = 'center';
      const winner = state.players[state.pendingResult.winner]?.name || 'Winner';
      ctx.fillText(`${winner} wins the skirmish`, w / 2, h * 0.38 + 32);
      ctx.textAlign = 'left';
    }
  }

  function resizeCanvas() {
    if (!canvas) return;
    const wrap = canvas.parentElement;
    const rect = wrap?.getBoundingClientRect();
    const w = Math.max(320, Math.floor(rect?.width || 720));
    const h = Math.max(220, Math.floor(rect?.height || 320));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }

  function tick(dt) {
    if (!active || !state) return;
    if (state.phase === 'planning') {
      state.planningLeft -= dt;
      if (state.planningLeft <= 0) {
        if (!me().ready) setReady(true);
        // Host forces the fight if the guest never pressed Ready.
        if (match.isHost && state.phase === 'planning') beginCombat();
      } else if (Math.floor(state.planningLeft) !== Math.floor(state.planningLeft + dt)) {
        renderHud();
      }
    } else if (state.phase === 'combat') {
      tickCombat(dt);
      drawCombat();
    } else if (state.phase === 'result') {
      drawCombat();
      state.resultTimer -= dt;
      if (state.resultTimer <= 0) {
        state.round += 1;
        startRound();
      }
    } else if (state.phase === 'gameover') {
      drawCombat();
    }
  }

  function bindUi() {
    if (uiBound) return;
    uiBound = true;

    $('tft-shop')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-shop]');
      if (!btn) return;
      tryBuy(Number(btn.getAttribute('data-shop')));
    });
    $('tft-reroll-btn')?.addEventListener('click', () => tryReroll());
    $('tft-xp-btn')?.addEventListener('click', () => tryBuyXp());
    $('tft-ready-btn')?.addEventListener('click', () => {
      if (me().ready) return;
      setReady(true);
    });
    $('tft-forfeit-btn')?.addEventListener('click', () => {
      window.TDG_PVP?.forfeitMatch?.();
      endMatch(1 - match.playerId);
    });

    const screen = $('tft-game-screen');
    screen?.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', () => endDrag(true));

    screen?.addEventListener('contextmenu', (e) => {
      if (state?.phase !== 'planning' || me().ready) return;
      const board = e.target.closest?.('.tft-board-cell');
      if (board?.querySelector('img')) {
        e.preventDefault();
        trySell({ area: 'board', r: Number(board.dataset.r), c: Number(board.dataset.c) });
        return;
      }
      const bench = e.target.closest?.('#tft-bench [data-bench]');
      if (bench?.querySelector('img')) {
        e.preventDefault();
        trySell({ area: 'bench', idx: Number(bench.getAttribute('data-bench')) });
      }
    });

    window.addEventListener('resize', () => {
      if (!active) return;
      resizeCanvas();
      if (state?.phase === 'combat' || state?.phase === 'result') drawCombat();
    });
  }

  function start(opts) {
    cleanup(false);
    match = {
      playerId: opts.myPlayerId === 1 ? 1 : 0,
      isHost: !!opts.isHost,
      roomId: opts.roomId || 'local',
      player0Name: opts.player0Name || 'Player 1',
      player1Name: opts.player1Name || 'Player 2',
    };
    state = {
      phase: 'planning',
      round: 1,
      players: [
        freshPlayer(0, match.player0Name),
        freshPlayer(1, match.player1Name),
      ],
      planningLeft: PLAN_SEC,
      combatUnits: [],
      projectiles: [],
      floatTexts: [],
      messages: [],
      combatFinished: false,
      resultApplied: false,
    };
    active = true;
    canvas = $('tft-combat-canvas');
    ctx = canvas?.getContext('2d') || null;
    resizeCanvas();

    $('menu-screen')?.classList.add('hidden');
    $('bottom-panel')?.classList.add('hidden');
    $('tft-game-screen')?.classList.remove('hidden');
    if (typeof gameMode !== 'undefined') gameMode = 'tft-pvp';
    if (typeof phase !== 'undefined') phase = 'tft';

    UNIT_POOL.forEach(getPortrait);
    bindUi();
    startRound();

    lastTs = performance.now();
    cancelAnimationFrame(raf);
    function loop(ts) {
      if (!active) return;
      const dt = Math.min(0.05, (ts - lastTs) / 1000);
      lastTs = ts;
      tick(dt);
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);
  }

  function cleanup(hideUi = true) {
    active = false;
    cancelAnimationFrame(raf);
    endDrag(true);
    state = null;
    match = null;
    ctx = null;
    if (hideUi) $('tft-game-screen')?.classList.add('hidden');
  }

  window.TFT_ONLINE = {
    start,
    cleanup,
    handleRemote: (from, action) => {
      if (!active) return false;
      return applyRemoteAction(from, action);
    },
    isActive: () => active,
  };
})();
