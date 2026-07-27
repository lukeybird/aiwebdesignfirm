/**
 * TFT Online — auto-battler mode for Block Fortress TDG.
 * Loaded after index.html game script; uses window.__TDG / window.TDG_PVP bridges.
 */
(function () {
  'use strict';

  const COLS = 4;
  const ROWS = 4;
  const BENCH = 9;
  const SHOP = 5;
  const START_HP = 100;
  const START_GOLD = 10;
  const PLAN_SEC = 50;
  const REROLL = 2;
  const XP_COST = 4;
  const XP_PER_BUY = 4;
  const MAX_LEVEL = 8;
  const LEVEL_XP = [0, 2, 6, 10, 20, 36, 56, 80];

  const UNIT_POOL = [
    'swordsman', 'bowman', 'striker', 'speed', 'goblin',
    'tank', 'farmer', 'sniper', 'wolf_hunter', 'yeti', 'angel', 'peka',
  ];

  const UNIT_COST = {
    swordsman: 1, bowman: 1, striker: 2, speed: 2, goblin: 2,
    tank: 3, farmer: 3, sniper: 3, wolf_hunter: 4, yeti: 4, angel: 4, peka: 5,
  };

  const TRAITS = {
    warrior: { units: ['striker', 'swordsman', 'tank'], name: 'Warrior', breakpoints: [2, 4], hpPct: [0.15, 0.3] },
    hunter: { units: ['sniper', 'bowman', 'wolf_hunter'], name: 'Hunter', breakpoints: [2, 4], dmgPct: [0.15, 0.3] },
    beast: { units: ['speed', 'wolf_hunter', 'yeti'], name: 'Beast', breakpoints: [2, 3], atkSpdPct: [0.12, 0.25] },
    mystic: { units: ['angel', 'yeti', 'farmer'], name: 'Mystic', breakpoints: [2, 3], hpPct: [0.1, 0.2] },
  };

  let active = false;
  let match = null;
  /** @type {{ phase: string, round: number, players: object[], planningLeft: number, combatUnits: object[], combatLog: string[], selected: object|null, drag: object|null, lastCombat: object|null, rng: function, messages: string[] }} */
  let state = null;
  let canvas = null;
  let ctx = null;
  let raf = 0;
  let lastTs = 0;

  function $(id) { return document.getElementById(id); }

  const UNIT_STATS = {
    swordsman: { name: 'Swordsman', hp: 68, damage: 20, attackRate: 0.85, range: 32, speed: 52, size: 20, color: '#e2e8f0' },
    bowman: { name: 'Archer', hp: 52, damage: 8, attackRate: 0.9, range: 90, speed: 52, size: 20, color: '#3f6212' },
    striker: { name: 'Knight', hp: 75, damage: 24, attackRate: 0.68, range: 30, speed: 74, size: 19, color: '#FF6B6B' },
    speed: { name: 'Wolf', hp: 58, damage: 17, attackRate: 1.28, range: 36, speed: 90, size: 18, color: '#F4F6FA' },
    goblin: { name: 'Goblin', hp: 48, damage: 14, attackRate: 1.1, range: 28, speed: 80, size: 14, color: '#4ade80' },
    tank: { name: 'Elephant', hp: 205, damage: 16, attackRate: 0.78, range: 32, speed: 50, size: 26, color: '#4ECDC4' },
    farmer: { name: 'Farmer', hp: 38, damage: 12, attackRate: 0.68, range: 30, speed: 37, size: 18, color: '#c4a574' },
    sniper: { name: 'Sniper', hp: 62, damage: 24, attackRate: 0.68, range: 100, speed: 34, size: 15, color: '#141414' },
    wolf_hunter: { name: 'Hunter', hp: 95, damage: 39, attackRate: 0.55, range: 42, speed: 34, size: 24, color: '#57534e' },
    yeti: { name: 'Yeti', hp: 390, damage: 26, attackRate: 0.9, range: 44, speed: 48, size: 30, color: '#9fd4ea' },
    angel: { name: 'Angel', hp: 280, damage: 22, attackRate: 0.75, range: 80, speed: 55, size: 23, color: '#1c1917' },
    peka: { name: 'Dragon', hp: 550, damage: 44, attackRate: 0.45, range: 90, speed: 42, size: 48, color: '#b91c1c' },
  };

  function unitDef(type) {
    const bridge = window.__TDG?.getTftUnitDef?.(type);
    const base = UNIT_STATS[type] || {};
    const labels = window.__TDG?.getTftUnitLabels?.() || {};
    const fromBridge = bridge || {};
    return {
      type,
      name: labels[type] || base.name || fromBridge.name || type,
      hp: fromBridge.hp || base.hp || 80,
      damage: fromBridge.damage || base.damage || 12,
      attackRate: fromBridge.attackRate || base.attackRate || 0.8,
      range: Math.min(fromBridge.range || base.range || 40, 120),
      speed: Math.min(fromBridge.speed || base.speed || 50, 90),
      size: fromBridge.size || base.size || 18,
      color: fromBridge.color || base.color || '#94a3b8',
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

  function roundSeed() {
    const rid = match?.roomId || 'tft';
    let h = 0;
    const s = `${rid}-${state.round}-${match?.playerId ?? 0}`;
    for (let i = 0; i < s.length; i++) h = Math.imul(31, h) + s.charCodeAt(i) | 0;
    return h >>> 0;
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

  function boardCap(p) {
    return Math.min(MAX_LEVEL, Math.max(1, p.level));
  }

  function boardCount(p) {
    let n = 0;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (p.board[r][c]) n++;
    return n;
  }

  function rollShop(p) {
    const rng = mulberry32(roundSeed() ^ (p.id + 1) * 9973);
    const shop = [];
    for (let i = 0; i < SHOP; i++) {
      const roll = rng();
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
    let base = 5 + state.round;
    base += Math.min(5, Math.floor(p.gold / 10));
    if (p.winStreak >= 2) base += Math.min(3, p.winStreak - 1);
    if (p.lossStreak >= 2) base += 1;
    return base;
  }

  function startRound() {
    state.phase = 'planning';
    state.planningLeft = PLAN_SEC;
    state.combatUnits = [];
    state.lastCombat = null;
    for (const p of state.players) {
      p.ready = false;
      p.gold += incomeFor(p);
      rollShop(p);
    }
    pushMsg(`Round ${state.round} — place your army (${PLAN_SEC}s)`);
    renderHud();
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

  function applyTraits(stats, traitCounts) {
    const out = { ...stats };
    for (const [tid, tr] of Object.entries(TRAITS)) {
      const n = traitCounts[tid] || 0;
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

  function spawnCombatUnits() {
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
          const bx = pid === 0 ? 120 + c * 72 : 520 + (COLS - 1 - c) * 72;
          const by = 140 + r * 72;
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
            speed: st.speed,
            size: def.size,
            color: def.color,
            x: bx,
            y: by,
            attackCd: 0,
            target: null,
            alive: true,
          });
        }
      }
    }
    state.combatUnits = units;
  }

  function dist(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.hypot(dx, dy);
  }

  function runCombatSim(maxSec = 35, respawn = true) {
    if (respawn) spawnCombatUnits();
    const rng = mulberry32(roundSeed() ^ 0xBEEF);
    const dt = 1 / 20;
    let t = 0;
    while (t < maxSec) {
      const alive0 = state.combatUnits.filter((u) => u.alive && u.owner === 0);
      const alive1 = state.combatUnits.filter((u) => u.alive && u.owner === 1);
      if (!alive0.length || !alive1.length) break;

      for (const u of state.combatUnits) {
        if (!u.alive) continue;
        const foes = state.combatUnits.filter((x) => x.alive && x.owner !== u.owner);
        if (!foes.length) continue;
        let best = foes[0];
        let bestD = dist(u, best);
        for (const f of foes) {
          const d = dist(u, f);
          if (d < bestD) { best = f; bestD = d; }
        }
        u.target = best;
        u.attackCd = Math.max(0, u.attackCd - dt);
        if (bestD <= u.range) {
          if (u.attackCd <= 0) {
            best.hp -= u.damage;
            u.attackCd = 1 / Math.max(0.2, u.attackRate);
            if (best.hp <= 0) best.alive = false;
          }
        } else {
          const dx = best.x - u.x;
          const dy = best.y - u.y;
          const mag = Math.hypot(dx, dy) || 1;
          u.x += (dx / mag) * u.speed * dt;
          u.y += (dy / mag) * u.speed * dt;
        }
      }
      t += dt;
    }
    const rem0 = state.combatUnits.filter((u) => u.alive && u.owner === 0);
    const rem1 = state.combatUnits.filter((u) => u.alive && u.owner === 1);
    let winner = null;
    if (rem0.length && !rem1.length) winner = 0;
    else if (rem1.length && !rem0.length) winner = 1;
    else if (rem0.length > rem1.length) winner = 0;
    else if (rem1.length > rem0.length) winner = 1;
    else winner = rng() < 0.5 ? 0 : 1;

    const dmg = Math.max(2, Math.min(15, (winner === 0 ? rem0 : rem1).length * 2 + state.round));
    return { winner, damage: dmg, rem0: rem0.length, rem1: rem1.length };
  }

  function applyCombatResult(result) {
    if (!result || state.phase !== 'combat') return;
    const loser = result.winner === 0 ? 1 : 0;
    const win = result.winner;
    state.players[loser].hp = Math.max(0, state.players[loser].hp - result.damage);
    state.players[win].winStreak += 1;
    state.players[win].lossStreak = 0;
    state.players[loser].lossStreak += 1;
    state.players[loser].winStreak = 0;
    state.lastCombat = result;
    state.phase = 'result';
    state.resultTimer = 4;
    const wName = state.players[win].name;
    const lName = state.players[loser].name;
    pushMsg(`${wName} wins the round! ${lName} takes ${result.damage} damage (${state.players[loser].hp} HP left)`);
    renderHud();
    if (state.players[0].hp <= 0 || state.players[1].hp <= 0) {
      endMatch(state.players[0].hp <= 0 ? 1 : 0);
    }
  }

  function beginCombat() {
    if (state.phase !== 'planning') return;
    state.phase = 'combat';
    state.combatTimer = 0;
    spawnCombatUnits();
    pushMsg('Battle!');
    renderHud();
    let frames = 0;
    const anim = () => {
      if (state.phase !== 'combat' || !active) return;
      drawCombat();
      frames += 1;
      if (frames < 36) requestAnimationFrame(anim);
    };
    requestAnimationFrame(anim);

    if (match.isHost) {
      const result = runCombatSim(35, false);
      state.pendingResult = result;
      broadcastAction({ type: 'tft_combat_result', result });
      setTimeout(() => applyCombatResult(result), 1800);
    }
  }

  function endMatch(winnerSlot) {
    state.phase = 'gameover';
    const me = match.playerId;
    const won = winnerSlot === me;
    pushMsg(won ? 'Victory!' : 'Defeat');
    renderHud();
    if (window.TDG_PVP?.notifyGameOver) {
      window.TDG_PVP.notifyGameOver({
        winnerSlot,
        endReason: 'base_destroyed',
      });
    }
    setTimeout(() => {
      cleanup();
      $('tft-game-screen')?.classList.add('hidden');
      $('menu-screen')?.classList.remove('hidden');
      if (typeof phase !== 'undefined') phase = 'menu';
      if (typeof gameMode !== 'undefined') gameMode = null;
    }, 3500);
  }

  function pushMsg(text) {
    state.messages.unshift(text);
    state.messages = state.messages.slice(0, 8);
    const el = $('tft-log');
    if (el) el.innerHTML = state.messages.map((m) => `<div class="tft-log-line">${escapeHtml(m)}</div>`).join('');
  }

  function escapeHtml(t) {
    return String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  }

  function me() { return state.players[match.playerId]; }
  function opp() { return state.players[1 - match.playerId]; }

  function tryBuy(shopIdx) {
    const p = me();
    if (state.phase !== 'planning' || p.ready) return false;
    const type = p.shop[shopIdx];
    if (!type) return false;
    const cost = UNIT_COST[type] || 2;
    if (p.gold < cost) return false;
    const slot = p.bench.findIndex((x) => !x);
    if (slot < 0) return false;
    p.gold -= cost;
    p.bench[slot] = { type, id: `${Date.now()}-${slot}` };
    broadcastAction({ type: 'tft_buy', shopIdx, playerId: match.playerId });
    renderHud();
    return true;
  }

  function trySell(ref) {
    const p = me();
    if (state.phase !== 'planning' || p.ready) return false;
    let type = null;
    if (ref.from === 'bench') {
      const u = p.bench[ref.idx];
      if (!u) return false;
      type = u.type;
      p.bench[ref.idx] = null;
    } else {
      const u = p.board[ref.r][ref.c];
      if (!u) return false;
      type = u.type;
      p.board[ref.r][ref.c] = null;
    }
    p.gold += Math.max(1, Math.floor((UNIT_COST[type] || 2) * 0.8));
    broadcastAction({ type: 'tft_sell', ref, playerId: match.playerId });
    renderHud();
    return true;
  }

  function tryMove(from, to) {
    const p = me();
    if (state.phase !== 'planning' || p.ready) return false;
    let unit = null;
    if (from.area === 'bench') unit = p.bench[from.idx];
    else unit = p.board[from.r][from.c];
    if (!unit) return false;

    if (to.area === 'bench') {
      if (p.bench[to.idx]) return false;
      if (from.area === 'bench') {
        p.bench[to.idx] = unit;
        p.bench[from.idx] = null;
      } else {
        p.bench[to.idx] = unit;
        p.board[from.r][from.c] = null;
      }
    } else {
      if (p.board[to.r][to.c]) return false;
      if (boardCount(p) >= boardCap(p) && from.area !== 'board') return false;
      if (from.area === 'bench') {
        p.board[to.r][to.c] = unit;
        p.bench[from.idx] = null;
      } else {
        p.board[to.r][to.c] = unit;
        p.board[from.r][from.c] = null;
      }
    }
    broadcastAction({ type: 'tft_move', from, to, playerId: match.playerId });
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

  function broadcastAction(action) {
    if (window.TDG_PVP?.sendAction) window.TDG_PVP.sendAction(action);
  }

  function applyRemoteAction(fromPlayerId, action) {
    if (!state || !action?.type) return false;
    const p = state.players[fromPlayerId];
    if (!p) return false;
    switch (action.type) {
      case 'tft_buy': {
        const type = p.shop[action.shopIdx];
        if (!type) return true;
        const cost = UNIT_COST[type] || 2;
        const slot = p.bench.findIndex((x) => !x);
        if (slot < 0 || p.gold < cost) return true;
        p.gold -= cost;
        p.bench[slot] = { type, id: `${fromPlayerId}-${slot}` };
        renderHud();
        return true;
      }
      case 'tft_sell': {
        const ref = action.ref;
        let type = null;
        if (ref.from === 'bench') {
          type = p.bench[ref.idx]?.type;
          p.bench[ref.idx] = null;
        } else {
          type = p.board[ref.r][ref.c]?.type;
          p.board[ref.r][ref.c] = null;
        }
        if (type) p.gold += Math.max(1, Math.floor((UNIT_COST[type] || 2) * 0.8));
        renderHud();
        return true;
      }
      case 'tft_move':
        applyMoveOnPlayer(p, action.from, action.to);
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
      case 'tft_combat_result':
        if (state.phase === 'planning') {
          beginCombat();
        }
        if (state.phase === 'combat' && !match.isHost) {
          setTimeout(() => applyCombatResult(action.result), 600);
        }
        return true;
      default:
        return false;
    }
  }

  function applyMoveOnPlayer(p, from, to) {
    let unit = null;
    if (from.area === 'bench') unit = p.bench[from.idx];
    else unit = p.board[from.r][from.c];
    if (!unit) return;
    if (to.area === 'bench') {
      if (p.bench[to.idx]) return;
      if (from.area === 'bench') {
        p.bench[to.idx] = unit;
        p.bench[from.idx] = null;
      } else {
        p.bench[to.idx] = unit;
        p.board[from.r][from.c] = null;
      }
    } else {
      if (p.board[to.r][to.c]) return;
      if (boardCount(p) >= boardCap(p) && from.area !== 'board') return;
      if (from.area === 'bench') {
        p.board[to.r][to.c] = unit;
        p.bench[from.idx] = null;
      } else {
        p.board[to.r][to.c] = unit;
        p.board[from.r][from.c] = null;
      }
    }
  }

  function renderHud() {
    if (!state) return;
    const p = me();
    const o = opp();
    $('tft-round-label') && ($('tft-round-label').textContent = `Round ${state.round}`);
    $('tft-phase-label') && ($('tft-phase-label').textContent =
      state.phase === 'planning' ? `Planning · ${Math.ceil(state.planningLeft)}s`
        : state.phase === 'combat' ? 'Combat'
          : state.phase === 'result' ? 'Result'
            : state.phase === 'gameover' ? 'Game Over' : state.phase);
    $('tft-you-hp') && ($('tft-you-hp').textContent = String(p.hp));
    $('tft-them-hp') && ($('tft-them-hp').textContent = String(o.hp));
    $('tft-gold') && ($('tft-gold').textContent = String(p.gold));
    $('tft-level') && ($('tft-level').textContent = `Lv ${p.level} (${p.xp}/${LEVEL_XP[p.level] ?? 'MAX'})`);
    $('tft-board-cap') && ($('tft-board-cap').textContent = `${boardCount(p)}/${boardCap(p)} on board`);
    $('tft-you-name') && ($('tft-you-name').textContent = p.name);
    $('tft-them-name') && ($('tft-them-name').textContent = o.name);
    $('tft-them-ready') && ($('tft-them-ready').textContent = o.ready ? 'Ready ✓' : 'Shopping…');

    const shopEl = $('tft-shop');
    if (shopEl) {
      shopEl.innerHTML = p.shop.map((type, i) => {
        const def = unitDef(type);
        const cost = UNIT_COST[type] || 2;
        const afford = p.gold >= cost && p.bench.some((x) => !x);
        return `<button type="button" class="tft-shop-card${afford ? '' : ' is-disabled'}" data-shop="${i}" ${afford && state.phase === 'planning' && !p.ready ? '' : 'disabled'}>`
          + `<img src="/TDG/portraits/${type}.webp" alt="" />`
          + `<span class="tft-shop-name">${escapeHtml(def.name)}</span>`
          + `<span class="tft-shop-cost">${cost}g</span></button>`;
      }).join('');
    }

    const benchEl = $('tft-bench');
    if (benchEl) {
      benchEl.innerHTML = p.bench.map((u, i) => {
        if (!u) return `<div class="tft-bench-slot" data-bench="${i}"></div>`;
        return `<div class="tft-bench-slot has-unit" data-bench="${i}" data-type="${u.type}">`
          + `<img src="/TDG/portraits/${u.type}.webp" alt="" /></div>`;
      }).join('');
    }

    const boardEl = $('tft-board');
    if (boardEl) {
      let html = '';
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const u = p.board[r][c];
          html += `<div class="tft-board-cell" data-r="${r}" data-c="${c}">`;
          if (u) html += `<img src="/TDG/portraits/${u.type}.webp" alt="" data-type="${u.type}" />`;
          html += '</div>';
        }
      }
      boardEl.innerHTML = html;
    }

    const traitsEl = $('tft-traits');
    if (traitsEl) {
      const counts = traitCounts(p);
      traitsEl.innerHTML = Object.entries(TRAITS).map(([id, tr]) => {
        const n = counts[id] || 0;
        const active = n >= tr.breakpoints[0];
        return `<span class="tft-trait${active ? ' is-active' : ''}">${tr.name} ${n}</span>`;
      }).join('');
    }

    $('tft-ready-btn') && ($('tft-ready-btn').disabled = state.phase !== 'planning' || p.ready);
    $('tft-reroll-btn') && ($('tft-reroll-btn').disabled = state.phase !== 'planning' || p.ready || p.gold < REROLL);
    $('tft-xp-btn') && ($('tft-xp-btn').disabled = state.phase !== 'planning' || p.ready || p.gold < XP_COST || p.level >= MAX_LEVEL);
  }

  function drawCombat() {
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.fillStyle = '#0f1410';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(124,184,124,0.08)';
    ctx.fillRect(40, 100, w - 80, h - 160);
    ctx.strokeStyle = 'rgba(201,212,184,0.25)';
    ctx.strokeRect(40, 100, w - 80, h - 160);
    ctx.font = '600 14px Rajdhani, sans-serif';
    ctx.fillStyle = '#c9d4b8';
    ctx.fillText(state.players[0].name, 48, 92);
    ctx.textAlign = 'right';
    ctx.fillText(state.players[1].name, w - 48, 92);
    ctx.textAlign = 'left';

    for (const u of state.combatUnits) {
      if (!u.alive) continue;
      ctx.beginPath();
      ctx.fillStyle = u.color;
      ctx.arc(u.x, u.y, u.size * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#111';
      ctx.fillRect(u.x - 16, u.y - u.size - 8, 32, 4);
      ctx.fillStyle = u.owner === 0 ? '#4ECDC4' : '#FF8E53';
      ctx.fillRect(u.x - 16, u.y - u.size - 8, 32 * (u.hp / u.maxHp), 4);
    }
  }

  function tick(dt) {
    if (!active || !state) return;
    if (state.phase === 'planning') {
      state.planningLeft -= dt;
      if (state.planningLeft <= 0) beginCombat();
      else if (Math.floor(state.planningLeft) !== Math.floor(state.planningLeft + dt)) renderHud();
    } else if (state.phase === 'result') {
      state.resultTimer -= dt;
      if (state.resultTimer <= 0) {
        state.round += 1;
        startRound();
      }
    }
    if (state.phase === 'combat' && ctx) drawCombat();
  }

  function bindUi() {
    $('tft-shop')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-shop]');
      if (!btn) return;
      tryBuy(Number(btn.getAttribute('data-shop')));
    });
    $('tft-reroll-btn')?.addEventListener('click', () => tryReroll());
    $('tft-xp-btn')?.addEventListener('click', () => tryBuyXp());
    $('tft-ready-btn')?.addEventListener('click', () => setReady(true));

    let dragFrom = null;
    const pick = (el) => {
      if (!el) return null;
      if (el.hasAttribute('data-bench')) return { area: 'bench', idx: Number(el.getAttribute('data-bench')) };
      if (el.classList.contains('tft-board-cell')) return { area: 'board', r: Number(el.getAttribute('data-r')), c: Number(el.getAttribute('data-c')) };
      const cell = el.closest('.tft-board-cell');
      if (cell) return { area: 'board', r: Number(cell.getAttribute('data-r')), c: Number(cell.getAttribute('data-c')) };
      const bench = el.closest('[data-bench]');
      if (bench) return { area: 'bench', idx: Number(bench.getAttribute('data-bench')) };
      return null;
    };

    $('tft-bench')?.addEventListener('mousedown', (e) => { dragFrom = pick(e.target.closest('[data-bench]')); });
    $('tft-board')?.addEventListener('mousedown', (e) => { dragFrom = pick(e.target.closest('.tft-board-cell')); });
    document.addEventListener('mouseup', (e) => {
      if (!dragFrom) return;
      const to = pick(e.target.closest('.tft-board-cell') || e.target.closest('[data-bench]'));
      if (to) tryMove(dragFrom, to);
      dragFrom = null;
    });
    $('tft-bench')?.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const b = e.target.closest('[data-bench]');
      if (b) trySell({ from: 'bench', idx: Number(b.getAttribute('data-bench')) });
    });
    $('tft-board')?.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const cell = e.target.closest('.tft-board-cell');
      if (cell) trySell({ from: 'board', r: Number(cell.getAttribute('data-r')), c: Number(cell.getAttribute('data-c')) });
    });
    $('tft-forfeit-btn')?.addEventListener('click', () => {
      if (window.TDG_PVP?.forfeitMatch) window.TDG_PVP.forfeitMatch();
      endMatch(1 - match.playerId);
    });
  }

  function start(opts) {
    cleanup();
    match = {
      playerId: opts.myPlayerId === 1 ? 1 : 0,
      isHost: !!opts.isHost,
      roomId: opts.roomId || '',
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
      messages: [],
      rng: mulberry32(12345),
    };
    active = true;
    canvas = $('tft-combat-canvas');
    if (canvas) {
      ctx = canvas.getContext('2d');
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (rect) { canvas.width = Math.floor(rect.width); canvas.height = Math.floor(rect.height); }
    }
    $('menu-screen')?.classList.add('hidden');
    $('bottom-panel')?.classList.add('hidden');
    $('tft-game-screen')?.classList.remove('hidden');
    if (typeof gameMode !== 'undefined') gameMode = 'tft-pvp';
    if (typeof phase !== 'undefined') phase = 'tft';
    startRound();
    renderHud();
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

  function cleanup() {
    active = false;
    cancelAnimationFrame(raf);
    state = null;
    match = null;
    ctx = null;
  }

  function handleRemote(fromPlayerId, action) {
    if (!active) return false;
    return applyRemoteAction(fromPlayerId, action);
  }

  window.TFT_ONLINE = {
    start,
    cleanup,
    handleRemote,
    isActive: () => active,
    tick,
  };

  bindUi();
})();
