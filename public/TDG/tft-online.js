/**
 * TFT Online — League-style auto-battler for Block Fortress.
 * Star merges (3→upgrade), cost-balanced units, left/right sides, TDG sprites.
 */
(function () {
  'use strict';

  const COLS = 4;
  const ROWS = 4;
  const BENCH = 9;
  const SHOP = 5;
  const START_HP = 100;
  const START_GOLD = 10;
  const REROLL = 2;
  const XP_COST = 4;
  const XP_PER_BUY = 4;
  const MAX_LEVEL = 9;
  const MAX_STAR = 3;
  const LEVEL_XP = [0, 2, 2, 6, 10, 20, 36, 48, 64, 80];
  const COMBAT_MAX_SEC = 35;
  const COMBAT_SPEED = 1.05;

  // ★ multipliers (TFT-like): 1 → 2 → 3
  const STAR_MULT = { 1: 1, 2: 1.8, 3: 3.24 };
  const STAR_SELL = { 1: 1, 2: 3, 3: 9 }; // gold returned = cost × this

  const UNIT_POOL = [
    'swordsman', 'bowman', 'striker', 'speed', 'goblin',
    'tank', 'farmer', 'sniper', 'wolf_hunter', 'yeti', 'angel', 'peka',
  ];

  const UNIT_COST = {
    swordsman: 1, bowman: 1,
    striker: 2, speed: 2, goblin: 2,
    tank: 3, farmer: 3, sniper: 3,
    wolf_hunter: 4, yeti: 4, angel: 4,
    peka: 5,
  };

  /**
   * Cost-balanced 1★ stats. Combat value ≈ HP × damage × attackRate ≈ 5500 × cost.
   * Roles trade HP vs DPS inside that envelope (tank / melee / ranged / carry).
   */
  const UNIT_STATS = {
    swordsman: { name: 'Swordsman', role: 'melee', hp: 340, damage: 22, attackRate: 0.82, range: 42, speed: 58, size: 22, color: '#e2e8f0' },
    bowman: { name: 'Archer', role: 'ranged', hp: 250, damage: 22, attackRate: 1.0, range: 175, speed: 52, size: 20, color: '#3f6212' },
    striker: { name: 'Knight', role: 'melee', hp: 440, damage: 32, attackRate: 0.85, range: 44, speed: 68, size: 22, color: '#FF6B6B' },
    speed: { name: 'Wolf', role: 'melee', hp: 320, damage: 30, attackRate: 1.15, range: 40, speed: 98, size: 20, color: '#F4F6FA' },
    goblin: { name: 'Goblin', role: 'melee', hp: 310, damage: 30, attackRate: 1.15, range: 38, speed: 92, size: 18, color: '#4ade80' },
    tank: { name: 'Elephant', role: 'tank', hp: 1000, damage: 32, attackRate: 0.52, range: 48, speed: 38, size: 32, color: '#4ECDC4' },
    farmer: { name: 'Farmer', role: 'melee', hp: 500, damage: 38, attackRate: 0.85, range: 42, speed: 52, size: 20, color: '#c4a574' },
    sniper: { name: 'Sniper', role: 'ranged', hp: 400, damage: 72, attackRate: 0.55, range: 210, speed: 36, size: 18, color: '#141414' },
    wolf_hunter: { name: 'Hunter', role: 'melee', hp: 650, damage: 50, attackRate: 0.7, range: 52, speed: 56, size: 26, color: '#57534e' },
    yeti: { name: 'Yeti', role: 'tank', hp: 1050, damage: 40, attackRate: 0.55, range: 50, speed: 40, size: 30, color: '#9fd4ea' },
    angel: { name: 'Angel', role: 'ranged', hp: 580, damage: 48, attackRate: 0.8, range: 165, speed: 60, size: 24, color: '#facc15' },
    peka: { name: 'Dragon', role: 'carry', hp: 1050, damage: 58, attackRate: 0.55, range: 130, speed: 44, size: 38, color: '#b91c1c' },
  };

  // Shop odds by player level [cost1..cost5] — TFT-inspired
  const SHOP_ODDS = {
    1: [100, 0, 0, 0, 0],
    2: [100, 0, 0, 0, 0],
    3: [75, 25, 0, 0, 0],
    4: [55, 30, 15, 0, 0],
    5: [45, 33, 20, 2, 0],
    6: [30, 40, 25, 5, 0],
    7: [19, 30, 35, 15, 1],
    8: [18, 25, 32, 20, 5],
    9: [10, 20, 25, 30, 15],
  };

  const TRAITS = {
    warrior: {
      name: 'Warrior', units: ['striker', 'swordsman', 'tank'],
      breakpoints: [2, 4],
      desc: 'Frontline fighters gain bonus max HP.',
      tiers: ['2: +18% HP', '4: +35% HP'],
      apply: (st, tier) => { st.hp = Math.round(st.hp * (1 + [0.18, 0.35][tier])); },
    },
    hunter: {
      name: 'Hunter', units: ['sniper', 'bowman', 'wolf_hunter'],
      breakpoints: [2, 4],
      desc: 'Sharpshooters deal bonus damage.',
      tiers: ['2: +18% damage', '4: +35% damage'],
      apply: (st, tier) => { st.damage = Math.round(st.damage * (1 + [0.18, 0.35][tier])); },
    },
    beast: {
      name: 'Beast', units: ['speed', 'wolf_hunter', 'yeti'],
      breakpoints: [2, 3],
      desc: 'Wild units attack faster.',
      tiers: ['2: +15% attack speed', '3: +30% attack speed'],
      apply: (st, tier) => { st.attackRate *= (1 + [0.15, 0.3][tier]); },
    },
    mystic: {
      name: 'Mystic', units: ['angel', 'yeti', 'farmer'],
      breakpoints: [2, 3],
      desc: 'Mystic units gain bonus HP.',
      tiers: ['2: +12% HP', '3: +25% HP'],
      apply: (st, tier) => { st.hp = Math.round(st.hp * (1 + [0.12, 0.25][tier])); },
    },
  };

  let active = false;
  let match = null;
  let state = null;
  let canvas = null;
  let ctx = null;
  let raf = 0;
  let lastTs = 0;
  let portraitCache = {};
  let drag = null;
  let uiBound = false;
  let selected = null; // { area:'board'|'bench'|'shop', r?, c?, idx?, type?, star? }

  function $(id) { return document.getElementById(id); }

  function escapeHtml(t) {
    return String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
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

  function uid() {
    return `u${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  }

  function makeUnit(type, star = 1) {
    return { type, star: Math.min(MAX_STAR, Math.max(1, star | 0)), id: uid() };
  }

  function unitCost(type) { return UNIT_COST[type] || 2; }

  function sellValue(unit) {
    return unitCost(unit.type) * (STAR_SELL[unit.star] || 1);
  }

  function starLabel(star) {
    return '★'.repeat(star || 1);
  }

  function baseStats(type) {
    const labels = window.__TDG?.getTftUnitLabels?.() || {};
    const base = UNIT_STATS[type] || {};
    return {
      type,
      name: labels[type] || base.name || type,
      role: base.role || 'melee',
      hp: base.hp || 300,
      damage: base.damage || 20,
      attackRate: base.attackRate || 0.8,
      range: base.range || 40,
      speed: base.speed || 50,
      size: base.size || 20,
      color: base.color || '#94a3b8',
      cost: unitCost(type),
    };
  }

  /** Combat stats for a unit at a given star, before traits. */
  function scaledStats(type, star) {
    const b = baseStats(type);
    const m = STAR_MULT[star] || 1;
    return {
      ...b,
      hp: Math.round(b.hp * m),
      damage: Math.round(b.damage * m),
      size: Math.round(b.size * (1 + (star - 1) * 0.18)),
      star,
    };
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

  function listArmy(p) {
    const out = [];
    for (let i = 0; i < BENCH; i++) {
      if (p.bench[i]) out.push({ area: 'bench', idx: i, unit: p.bench[i] });
    }
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (p.board[r][c]) out.push({ area: 'board', r, c, unit: p.board[r][c] });
      }
    }
    return out;
  }

  function getUnitAt(p, ref) {
    if (!ref) return null;
    if (ref.area === 'bench') return p.bench[ref.idx] || null;
    return p.board[ref.r]?.[ref.c] || null;
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

  function emptyBenchSlot(p) {
    return p.bench.findIndex((x) => !x);
  }

  function pushMsg(text) {
    state.messages.unshift(text);
    state.messages = state.messages.slice(0, 12);
    const el = $('tft-log');
    if (el) el.innerHTML = state.messages.map((m) => `<div class="tft-log-line">${escapeHtml(m)}</div>`).join('');
  }

  function broadcastAction(action) {
    window.TDG_PVP?.sendAction?.(action);
  }

  function serializeArmy(p) {
    return {
      bench: p.bench.map((u) => (u ? { type: u.type, star: u.star, id: u.id } : null)),
      board: p.board.map((row) => row.map((u) => (u ? { type: u.type, star: u.star, id: u.id } : null))),
      gold: p.gold,
      level: p.level,
      xp: p.xp,
      shop: p.shop.slice(),
    };
  }

  function applyArmySnapshot(p, snap) {
    if (!snap) return;
    if (snap.bench) {
      p.bench = snap.bench.map((u) => (u ? { type: u.type, star: u.star || 1, id: u.id || uid() } : null));
    }
    if (snap.board) {
      p.board = snap.board.map((row) => row.map((u) => (u ? { type: u.type, star: u.star || 1, id: u.id || uid() } : null)));
    }
    if (snap.gold != null) p.gold = snap.gold;
    if (snap.level != null) p.level = snap.level;
    if (snap.xp != null) p.xp = snap.xp;
    if (snap.shop) p.shop = snap.shop.slice();
  }

  function syncArmy(p) {
    broadcastAction({
      type: 'tft_army_sync',
      playerId: p.id,
      army: serializeArmy(p),
    });
  }

  // ─── Merges (3 identical → next star) ──────────────────────────────────────

  function tryAutoMerge(p, announce = true) {
    let any = false;
    let guard = 0;
    while (guard++ < 24) {
      let merged = false;
      for (let star = 1; star < MAX_STAR; star++) {
        for (const type of UNIT_POOL) {
          const copies = listArmy(p).filter((x) => x.unit.type === type && (x.unit.star || 1) === star);
          if (copies.length < 3) continue;

          const take = copies.slice(0, 3);
          // Prefer keeping a board slot for the upgrade
          const boardKeep = take.find((x) => x.area === 'board') || take[0];
          for (const slot of take) {
            if (slot === boardKeep) continue;
            if (slot.area === 'bench') p.bench[slot.idx] = null;
            else p.board[slot.r][slot.c] = null;
          }
          const upgraded = makeUnit(type, star + 1);
          if (boardKeep.area === 'bench') p.bench[boardKeep.idx] = upgraded;
          else p.board[boardKeep.r][boardKeep.c] = upgraded;

          if (announce) {
            const name = baseStats(type).name;
            pushMsg(`${p.name}: ${name} → ${starLabel(star + 1)}!`);
          }
          merged = true;
          any = true;
          break;
        }
        if (merged) break;
      }
      if (!merged) break;
    }
    return any;
  }

  // ─── Shop ──────────────────────────────────────────────────────────────────

  function rollCost(level, rng) {
    const odds = SHOP_ODDS[Math.min(9, Math.max(1, level))] || SHOP_ODDS[1];
    const roll = rng() * 100;
    let acc = 0;
    for (let i = 0; i < 5; i++) {
      acc += odds[i];
      if (roll < acc) return i + 1;
    }
    return 1;
  }

  function rollShop(p) {
    const seed = hashSeed(`${match.roomId}|r${state.round}|p${p.id}|shop|${p.level}|g${p.gold}`);
    const rng = mulberry32(seed ^ (state.round * 7919));
    // Re-roll seed with a counter so rerolls differ — use shopGen
    p.shopGen = (p.shopGen || 0) + 1;
    const rng2 = mulberry32(seed ^ (p.shopGen * 104729));
    const shop = [];
    for (let i = 0; i < SHOP; i++) {
      const cost = rollCost(p.level, rng2);
      const pool = UNIT_POOL.filter((u) => unitCost(u) === cost);
      const use = pool.length ? pool : UNIT_POOL.filter((u) => unitCost(u) === 1);
      shop.push(use[Math.floor(rng2() * use.length)]);
    }
    p.shop = shop;
  }

  function incomeFor(p) {
    let base = 5 + Math.min(5, state.round);
    base += Math.min(5, Math.floor(p.gold / 10)); // interest
    if (p.winStreak >= 2) base += Math.min(3, p.winStreak - 1);
    if (p.lossStreak >= 2) base += Math.min(2, p.lossStreak - 1);
    return base;
  }

  function traitCounts(p) {
    const counts = {};
    const types = new Set();
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const u = p.board[r][c];
        if (u) types.add(u.type);
      }
    }
    for (const [tid, tr] of Object.entries(TRAITS)) {
      counts[tid] = [...types].filter((t) => tr.units.includes(t)).length;
    }
    p.traits = counts;
    return counts;
  }

  function applyTraitsToStats(stats, counts) {
    const out = { ...stats };
    for (const [tid, tr] of Object.entries(TRAITS)) {
      const n = counts[tid] || 0;
      let tier = -1;
      for (let i = tr.breakpoints.length - 1; i >= 0; i--) {
        if (n >= tr.breakpoints[i]) { tier = i; break; }
      }
      if (tier >= 0) tr.apply(out, tier);
    }
    return out;
  }

  // ─── Combat arena: LEFT vs RIGHT ───────────────────────────────────────────

  function arenaLayout() {
    const w = canvas?.width || 800;
    const h = canvas?.height || 400;
    const padX = Math.max(40, w * 0.05);
    const padY = Math.max(50, h * 0.14);
    const midGap = Math.max(48, w * 0.08);
    const mid = w / 2;
    const halfW = mid - padX - midGap / 2;
    const cellW = halfW / COLS;
    const cellH = (h - padY * 2) / ROWS;
    return { w, h, padX, padY, mid, midGap, halfW, cellW, cellH };
  }

  /**
   * Board cell → world position.
   * Player 0 owns LEFT side facing right; player 1 owns RIGHT facing left.
   * Board columns: c=0 is FRONTLINE (toward mid), c=COLS-1 is BACKLINE.
   */
  function boardCellPos(pid, r, c, layout) {
    const { padX, padY, mid, midGap, cellW, cellH, w } = layout;
    // Frontline toward center: invert column so c=0 is near mid
    const frontC = (COLS - 1 - c);
    if (pid === 0) {
      // Left side: backline near left edge, frontline near mid
      return {
        x: padX + frontC * cellW + cellW * 0.5,
        y: padY + r * cellH + cellH * 0.5,
      };
    }
    return {
      x: w - padX - frontC * cellW - cellW * 0.5,
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
          const st0 = scaledStats(cell.type, cell.star || 1);
          const st = applyTraitsToStats(st0, traits[pid]);
          const pos = boardCellPos(pid, r, c, layout);
          units.push({
            uid: cell.id || `${pid}-${r}-${c}`,
            owner: pid,
            type: cell.type,
            star: cell.star || 1,
            name: st.name,
            role: st.role,
            hp: st.hp,
            maxHp: st.hp,
            damage: st.damage,
            attackRate: st.attackRate,
            range: st.range,
            speed: st.speed * 1.2,
            size: st.size,
            color: st.color,
            x: pos.x,
            y: pos.y,
            facing: pid === 0 ? 0 : Math.PI,
            attackCd: 0.1 + (r * 0.05 + c * 0.03),
            attackFlash: 0,
            hitFlash: 0,
            attackPhase: 'idle',
            attackProgress: 0,
            moveSpeed: 0,
            targetUid: null,
            alive: true,
            deathT: 0,
            animT: Math.random() * 10,
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

  function addFloat(x, y, text, color) {
    state.floatTexts.push({ x, y, text, color, life: 0.9 });
  }

  function computeResultFromField() {
    const rem0 = state.combatUnits.filter((u) => u.alive && u.owner === 0);
    const rem1 = state.combatUnits.filter((u) => u.alive && u.owner === 1);
    const seed = state.combatSeed || 1;
    const rng = mulberry32(seed ^ 0xC0FFEE);
    let winner;
    if (rem0.length && !rem1.length) winner = 0;
    else if (rem1.length && !rem0.length) winner = 1;
    else if (rem0.length !== rem1.length) winner = rem0.length > rem1.length ? 0 : 1;
    else {
      const hp0 = rem0.reduce((s, u) => s + u.hp, 0);
      const hp1 = rem1.reduce((s, u) => s + u.hp, 0);
      if (Math.abs(hp0 - hp1) > 1) winner = hp0 > hp1 ? 0 : 1;
      else winner = rng() < 0.5 ? 0 : 1;
    }
    const survivors = (winner === 0 ? rem0 : rem1);
    const starBonus = survivors.reduce((s, u) => s + (u.star || 1), 0);
    const damage = Math.max(4, Math.min(20, survivors.length * 2 + starBonus + Math.ceil(state.round * 0.7)));
    return { winner, damage, rem0: rem0.length, rem1: rem1.length };
  }

  function tickCombat(dt) {
    if (state.phase !== 'combat' || state.combatFinished) return;
    const step = dt * COMBAT_SPEED;
    state.combatElapsed += step;
    const layout = arenaLayout();

    for (const u of state.combatUnits) {
      u.animT += step;
      if (!u.alive) {
        u.deathT = Math.min(1, u.deathT + step * 1.5);
        u.moveSpeed = 0;
        continue;
      }
      u.attackFlash = Math.max(0, u.attackFlash - step * 3.5);
      u.hitFlash = Math.max(0, u.hitFlash - step * 5);
      u.attackCd = Math.max(0, u.attackCd - step);
      if (u.attackPhase !== 'idle') {
        u.attackProgress = Math.min(1, u.attackProgress + step * 3.2);
        if (u.attackProgress >= 1) {
          u.attackPhase = 'idle';
          u.attackProgress = 0;
        }
      }

      const foes = state.combatUnits.filter((x) => x.alive && x.owner !== u.owner);
      if (!foes.length) {
        u.moveSpeed = 0;
        continue;
      }

      let best = foes[0];
      let bestD = dist(u, best);
      for (const f of foes) {
        const d = dist(u, f);
        if (d < bestD) { best = f; bestD = d; }
      }
      u.targetUid = best.uid;
      u.facing = Math.atan2(best.y - u.y, best.x - u.x);

      const stopRange = Math.max(28, u.range * 0.88);
      if (bestD <= stopRange) {
        u.moveSpeed = 0;
        if (u.attackCd <= 0) {
          u.attackCd = 1 / Math.max(0.28, u.attackRate);
          u.attackFlash = 1;
          u.attackPhase = 'strike';
          u.attackProgress = 0;
          const ranged = u.range >= 90;
          if (ranged) {
            state.projectiles.push({
              x: u.x,
              y: u.y - 10,
              tx: best.x,
              ty: best.y - 6,
              to: best.uid,
              damage: u.damage,
              color: u.color,
              life: 0.32,
              maxLife: 0.32,
            });
          } else {
            best.hp -= u.damage;
            best.hitFlash = 1;
            addFloat(best.x, best.y - best.size, `-${u.damage}`, '#ffb4a2');
            if (best.hp <= 0) {
              best.alive = false;
              best.deathT = 0;
              addFloat(best.x, best.y - 10, 'KO', '#f0d878');
            }
          }
        }
      } else {
        const dx = best.x - u.x;
        const dy = best.y - u.y;
        const mag = Math.hypot(dx, dy) || 1;
        const vx = (dx / mag) * u.speed * step;
        const vy = (dy / mag) * u.speed * step;
        u.x += vx;
        u.y += vy;
        u.moveSpeed = u.speed;
        // Soft clamp: don't let units leave the arena
        u.x = Math.max(24, Math.min(layout.w - 24, u.x));
        u.y = Math.max(36, Math.min(layout.h - 24, u.y));
      }
    }

    for (let i = state.projectiles.length - 1; i >= 0; i--) {
      const p = state.projectiles[i];
      p.life -= step;
      const t = 1 - Math.max(0, p.life) / p.maxLife;
      p.x += (p.tx - p.x) * Math.min(1, step * 9);
      p.y += (p.ty - p.y) * Math.min(1, step * 9);
      if (t >= 0.9 || p.life <= 0) {
        const target = findUnit(p.to);
        if (target?.alive) {
          target.hp -= p.damage;
          target.hitFlash = 1;
          addFloat(target.x, target.y - target.size, `-${p.damage}`, '#7dd3fc');
          if (target.hp <= 0) {
            target.alive = false;
            target.deathT = 0;
            addFloat(target.x, target.y - 10, 'KO', '#f0d878');
          }
        }
        state.projectiles.splice(i, 1);
      }
    }

    for (let i = state.floatTexts.length - 1; i >= 0; i--) {
      const f = state.floatTexts[i];
      f.life -= step;
      f.y -= 30 * step;
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
    if (match.isHost) broadcastAction({ type: 'tft_combat_result', result });
    setTimeout(() => applyCombatResult(result), 1100);
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
    state.resultTimer = 3.2;
    pushMsg(`${state.players[win].name} wins! ${state.players[loser].name} −${result.damage} HP (${state.players[loser].hp})`);
    setShellMode('result');
    renderHud();
    if (state.players[0].hp <= 0 || state.players[1].hp <= 0) {
      endMatch(state.players[0].hp <= 0 ? 1 : 0);
    }
  }

  function beginCombat(opts = {}) {
    if (state.phase === 'combat' && !opts.force) return;
    if (state.phase !== 'planning' && !opts.force) return;
    endDrag(true);
    state.phase = 'combat';
    state.resultApplied = false;
    state.combatFinished = false;
    state.pendingResult = null;
    state.combatSeed = opts.seed || hashSeed(`${match.roomId}|combat|${state.round}`);
    setShellMode('combat');
    resizeCanvas();
    spawnCombatUnits();
    // Layout expands when combat UI shows — resize + respawn once so positions match.
    requestAnimationFrame(() => {
      if (!active || !state || state.phase !== 'combat') return;
      resizeCanvas();
      if (!state.combatUnits?.length) spawnCombatUnits();
      drawCombat();
    });
    pushMsg('Battle — left vs right!');
    renderHud();
    if (match.isHost && !opts.fromRemote) {
      broadcastAction({
        type: 'tft_combat_start',
        seed: state.combatSeed,
        armies: [serializeArmy(state.players[0]), serializeArmy(state.players[1])],
      });
    }
  }

  function startRound() {
    state.phase = 'planning';
    state.combatUnits = [];
    state.projectiles = [];
    state.floatTexts = [];
    state.combatFinished = false;
    state.resultApplied = false;
    state.pendingResult = null;
    selected = null;
    for (const p of state.players) {
      p.ready = false;
      p.gold += incomeFor(p);
      rollShop(p);
    }
    pushMsg(`Round ${state.round} — shop, merge 3 copies, place your army. Ready when set.`);
    setShellMode('planning');
    renderHud();
  }

  function endMatch(winnerSlot) {
    state.phase = 'gameover';
    setShellMode('gameover');
    pushMsg(winnerSlot === match.playerId ? 'Victory!' : 'Defeat');
    renderHud();
    window.TDG_PVP?.notifyGameOver?.({ winnerSlot, endReason: 'base_destroyed' });
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

  // ─── Player actions ────────────────────────────────────────────────────────

  function tryBuy(shopIdx) {
    const p = me();
    if (state.phase !== 'planning' || p.ready) return false;
    const type = p.shop[shopIdx];
    if (!type) return false;
    const cost = unitCost(type);
    if (p.gold < cost) return false;
    const slot = emptyBenchSlot(p);
    if (slot < 0) {
      pushMsg('Bench full — sell or place a unit.');
      return false;
    }
    p.gold -= cost;
    p.bench[slot] = makeUnit(type, 1);
    p.shop[shopIdx] = null;
    tryAutoMerge(p, true);
    syncArmy(p);
    renderHud();
    return true;
  }

  function trySell(ref) {
    const p = me();
    if (state.phase !== 'planning' || p.ready) return false;
    const unit = getUnitAt(p, ref);
    if (!unit) return false;
    setUnitAt(p, ref, null);
    p.gold += sellValue(unit);
    syncArmy(p);
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
        pushMsg(`Board full (${boardCap(p)}). Buy XP to level up.`);
        return false;
      }
    }

    if (dest) {
      setUnitAt(p, from, dest);
      setUnitAt(p, to, moving);
    } else {
      setUnitAt(p, to, moving);
      setUnitAt(p, from, null);
    }
    tryAutoMerge(p, true);
    syncArmy(p);
    renderHud();
    return true;
  }

  function tryReroll() {
    const p = me();
    if (state.phase !== 'planning' || p.ready || p.gold < REROLL) return false;
    p.gold -= REROLL;
    rollShop(p);
    syncArmy(p);
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
    syncArmy(p);
    renderHud();
    return true;
  }

  function snapBoardCount(snap) {
    if (!snap?.board) return 0;
    let n = 0;
    for (const row of snap.board) {
      for (const u of row || []) if (u) n++;
    }
    return n;
  }

  function setReady(val) {
    const p = me();
    if (state.phase !== 'planning') return;
    p.ready = val;
    // Sync army with ready so the host has both boards before combat.
    syncArmy(p);
    broadcastAction({ type: 'tft_ready', ready: val, playerId: match.playerId });
    renderHud();
    checkPlanningEnd();
  }

  function checkPlanningEnd() {
    if (state.phase !== 'planning') return;
    if (!(state.players[0].ready && state.players[1].ready)) return;
    // Only the host starts combat; guest waits for tft_combat_start.
    if (match.isHost) beginCombat();
  }

  function applyRemoteArmies(armies) {
    if (!armies) return;
    for (let i = 0; i < 2; i++) {
      const snap = armies[i];
      if (!snap) continue;
      // Never let a stale empty snapshot wipe our local board.
      if (i === match.playerId && snapBoardCount(snap) < boardCount(state.players[i])) continue;
      applyArmySnapshot(state.players[i], snap);
    }
  }

  function applyRemoteAction(fromPlayerId, action) {
    if (!state || !action?.type) return false;
    const p = state.players[fromPlayerId];

    switch (action.type) {
      case 'tft_army_sync': {
        const targetId = action.playerId ?? fromPlayerId;
        const target = state.players[targetId];
        if (target && targetId !== match.playerId) applyArmySnapshot(target, action.army);
        renderHud();
        return true;
      }
      case 'tft_ready':
        if (p) p.ready = !!action.ready;
        renderHud();
        checkPlanningEnd();
        return true;
      case 'tft_combat_start':
        if (state.phase === 'planning' || state.phase === 'result' || state.phase === 'combat') {
          applyRemoteArmies(action.armies);
          beginCombat({ seed: action.seed, fromRemote: true, force: true });
        }
        return true;
      case 'tft_combat_result':
        if (state.phase === 'planning') {
          applyRemoteArmies(action.armies);
          beginCombat({ force: true, fromRemote: true });
        }
        if (!match.isHost && (state.phase === 'combat' || state.phase === 'result')) {
          setTimeout(() => applyCombatResult(action.result), state.combatFinished ? 200 : 500);
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
    const board = el.closest?.('.tft-board-cell:not(.is-opp)');
    if (board && board.closest('#tft-board')) {
      return { area: 'board', r: Number(board.dataset.r), c: Number(board.dataset.c) };
    }
    const bench = el.closest?.('#tft-bench [data-bench]');
    if (bench) return { area: 'bench', idx: Number(bench.getAttribute('data-bench')) };
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
    document.querySelectorAll('#tft-board .tft-board-cell').forEach((cell) => {
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
    if (from.area === 'bench') {
      document.querySelector(`#tft-bench [data-bench="${from.idx}"]`)?.classList.add('tft-dragging-source');
    } else {
      document.querySelector(`#tft-board .tft-board-cell[data-r="${from.r}"][data-c="${from.c}"]`)?.classList.add('tft-dragging-source');
    }
    highlightDrops(from);
  }

  function createGhost(unit, x, y) {
    const ghost = document.createElement('div');
    ghost.className = 'tft-drag-ghost';
    ghost.innerHTML = `<img src="/TDG/portraits/${unit.type}.webp" alt="" />`
      + `<span class="tft-star-badge star-${unit.star}">${starLabel(unit.star)}</span>`
      + `<span>${escapeHtml(baseStats(unit.type).name)}</span>`;
    ghost.style.left = `${x}px`;
    ghost.style.top = `${y}px`;
    document.body.appendChild(ghost);
    return ghost;
  }

  function endDrag(cancel) {
    if (!drag) return;
    const from = drag.from;
    const wasPending = !!drag.pending;
    drag.ghost?.remove();
    const under = drag.lastEl;
    drag = null;
    clearDropHighlights();
    document.body.classList.remove('tft-is-dragging');
    if (cancel || wasPending) {
      if (!cancel) renderHud();
      return;
    }
    const to = parseDropTarget(under);
    if (!to) { renderHud(); return; }
    if (to.area === 'sell') { trySell(from); return; }
    tryMoveOrSwap(from, to);
  }

  function startDrag(from, unit, e) {
    if (drag) endDrag(true);
    drag = {
      from,
      unit,
      pending: true,
      ghost: null,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      lastEl: null,
    };
    try { e.target.setPointerCapture?.(e.pointerId); } catch { /* */ }
  }

  function activateDrag(e) {
    if (!drag || !drag.pending || me().ready) return;
    drag.pending = false;
    drag.ghost = createGhost(drag.unit, e.clientX, e.clientY);
    document.body.classList.add('tft-is-dragging');
    markSource(drag.from);
  }

  function highlightSelection() {
    document.querySelectorAll('.tft-board-cell.is-selected, .tft-bench-slot.is-selected, .tft-shop-card.is-inspect')
      .forEach((el) => el.classList.remove('is-selected', 'is-inspect'));
    if (!selected) return;
    if (selected.area === 'board') {
      document.querySelector(`#tft-board .tft-board-cell[data-r="${selected.r}"][data-c="${selected.c}"]`)
        ?.classList.add('is-selected');
    } else if (selected.area === 'bench') {
      document.querySelector(`#tft-bench [data-bench="${selected.idx}"]`)?.classList.add('is-selected');
    } else if (selected.area === 'shop') {
      document.querySelector(`#tft-shop [data-shop="${selected.idx}"]`)?.classList.add('is-inspect');
    }
  }

  function onPointerDown(e) {
    if (!active || state?.phase !== 'planning') return;
    if (e.button !== undefined && e.button !== 0) return;
    const board = e.target.closest?.('#tft-board .tft-board-cell');
    if (board?.querySelector('.tft-unit-chip')) {
      const r = Number(board.dataset.r);
      const c = Number(board.dataset.c);
      const unit = me().board[r][c];
      if (!unit) return;
      e.preventDefault();
      selected = { area: 'board', r, c };
      renderInspectPanel();
      highlightSelection();
      if (!me().ready) startDrag({ area: 'board', r, c }, unit, e);
      return;
    }
    const bench = e.target.closest?.('#tft-bench [data-bench]');
    if (bench?.querySelector('.tft-unit-chip')) {
      const idx = Number(bench.getAttribute('data-bench'));
      const unit = me().bench[idx];
      if (!unit) return;
      e.preventDefault();
      selected = { area: 'bench', idx };
      renderInspectPanel();
      highlightSelection();
      if (!me().ready) startDrag({ area: 'bench', idx }, unit, e);
    }
  }

  function onPointerMove(e) {
    if (!drag || (drag.pointerId != null && e.pointerId !== drag.pointerId)) return;
    if (drag.pending) {
      const dist = Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY);
      if (dist < 8) return;
      activateDrag(e);
    }
    if (!drag?.ghost) return;
    drag.ghost.style.left = `${e.clientX}px`;
    drag.ghost.style.top = `${e.clientY}px`;
    drag.lastEl = document.elementFromPoint(e.clientX, e.clientY);
  }

  function onPointerUp(e) {
    if (!drag) return;
    if (drag.pointerId != null && e.pointerId !== drag.pointerId) return;
    if (drag.pending) {
      drag = null;
      renderHud();
      return;
    }
    drag.lastEl = document.elementFromPoint(e.clientX, e.clientY) || drag.lastEl;
    endDrag(false);
  }

  // ─── HUD ───────────────────────────────────────────────────────────────────

  function unitChipHtml(unit) {
    if (!unit) return '';
    const def = baseStats(unit.type);
    const star = unit.star || 1;
    return `<div class="tft-unit-chip star-${star}" data-type="${unit.type}">`
      + `<img src="/TDG/portraits/${unit.type}.webp" alt="" draggable="false" />`
      + `<span class="tft-star-badge">${starLabel(star)}</span>`
      + `<span class="tft-unit-cost">${def.cost}</span>`
      + `</div>`;
  }

  function traitsForType(type) {
    return Object.entries(TRAITS)
      .filter(([, tr]) => tr.units.includes(type))
      .map(([id, tr]) => ({ id, name: tr.name }));
  }

  function selectedUnit() {
    if (!selected || !state) return null;
    const p = me();
    if (selected.area === 'board') return p.board[selected.r]?.[selected.c] || null;
    if (selected.area === 'bench') return p.bench[selected.idx] || null;
    if (selected.area === 'shop') {
      const type = p.shop[selected.idx];
      return type ? { type, star: 1, id: `shop-${selected.idx}` } : null;
    }
    if (selected.area === 'preview' && selected.type) {
      return { type: selected.type, star: selected.star || 1, id: 'preview' };
    }
    return null;
  }

  function clearSelectionIfGone() {
    if (!selected) return;
    if (!selectedUnit()) selected = null;
  }

  function formatRole(role) {
    if (role === 'ranged') return 'Ranged';
    if (role === 'tank') return 'Tank';
    if (role === 'carry') return 'Carry';
    return 'Melee';
  }

  function renderInspectPanel() {
    const el = $('tft-inspect');
    if (!el) return;
    clearSelectionIfGone();
    const unit = selectedUnit();
    if (!unit) {
      el.innerHTML = '<div class="tft-inspect-empty">Select a unit to see its stats</div>';
      return;
    }
    const star = unit.star || 1;
    const base = scaledStats(unit.type, star);
    const counts = traitCounts(me());
    const withTraits = applyTraitsToStats({ ...base }, counts);
    const traitNames = traitsForType(unit.type).map((t) => t.name);
    const dps = Math.round(withTraits.damage * withTraits.attackRate);
    el.innerHTML = `
      <div class="tft-inspect-head">
        <img src="/TDG/portraits/${unit.type}.webp" alt="" />
        <div>
          <div class="tft-inspect-title">${escapeHtml(base.name)} ${starLabel(star)}</div>
          <div class="tft-inspect-sub">${formatRole(base.role)} · Cost ${base.cost}g · Sell ${sellValue(unit)}g</div>
        </div>
      </div>
      <div class="tft-inspect-grid">
        <div><span>HP</span><br><strong>${withTraits.hp}</strong></div>
        <div><span>Damage</span><br><strong>${withTraits.damage}</strong></div>
        <div><span>Atk speed</span><br><strong>${withTraits.attackRate.toFixed(2)}/s</strong></div>
        <div><span>DPS</span><br><strong>${dps}</strong></div>
        <div><span>Range</span><br><strong>${withTraits.range}</strong></div>
        <div><span>Move</span><br><strong>${withTraits.speed}</strong></div>
      </div>
      <div class="tft-inspect-traits">
        ${traitNames.length ? `Traits: ${traitNames.join(', ')}` : 'No traits'}
        ${withTraits.hp !== base.hp || withTraits.damage !== base.damage || Math.abs(withTraits.attackRate - base.attackRate) > 0.001
          ? `<br><span style="opacity:0.75">Active trait bonuses applied</span>` : ''}
      </div>
    `;
  }

  function countOwned(p, type, star) {
    return listArmy(p).filter((x) => x.unit.type === type && (x.unit.star || 1) === star).length;
  }

  function renderHud() {
    if (!state) return;
    const p = me();
    const o = opp();
    const planning = state.phase === 'planning';
    const setText = (id, text) => { const el = $(id); if (el) el.textContent = text; };

    setText('tft-round-label', `Round ${state.round}`);
    setText('tft-phase-label',
      planning ? 'Planning'
        : state.phase === 'combat' ? `Fight · ${Math.ceil(state.combatElapsed || 0)}s`
          : state.phase === 'result' ? 'Round result'
            : 'Game Over');
    setText('tft-you-hp', String(p.hp));
    setText('tft-them-hp', String(o.hp));
    setText('tft-gold', String(p.gold));
    setText('tft-level', `Lv ${p.level} (${p.xp}/${LEVEL_XP[p.level] ?? 'MAX'})`);
    setText('tft-board-cap', `${boardCount(p)}/${boardCap(p)}`);
    setText('tft-you-name', p.name);
    setText('tft-them-name', o.name);
    setText('tft-them-ready', o.ready ? 'Ready ✓' : 'Shopping…');
    setText('tft-income-preview', planning ? `+${incomeFor(p)}g next · merge 3× same ★` : '');

    const shopEl = $('tft-shop');
    if (shopEl) {
      shopEl.innerHTML = p.shop.map((type, i) => {
        if (!type) return `<div class="tft-shop-card is-empty"></div>`;
        const def = baseStats(type);
        const cost = unitCost(type);
        const afford = p.gold >= cost && emptyBenchSlot(p) >= 0;
        const owned1 = countOwned(p, type, 1);
        const mergeHint = owned1 >= 2 ? 'tft-shop-merge' : '';
        const inspect = selected?.area === 'shop' && selected.idx === i ? ' is-inspect' : '';
        // Keep clickable while planning so players can inspect stats even if they can't afford it.
        return `<button type="button" class="tft-shop-card ${mergeHint}${inspect}${afford ? '' : ' is-disabled'}" data-shop="${i}" ${planning ? '' : 'disabled'}>`
          + `<img src="/TDG/portraits/${type}.webp" alt="" draggable="false" />`
          + `<span class="tft-shop-name">${escapeHtml(def.name)}</span>`
          + `<span class="tft-shop-cost">${cost}g</span>`
          + (owned1 ? `<span class="tft-shop-owned">${owned1}/3</span>` : '')
          + `</button>`;
      }).join('');
    }

    const boardEl = $('tft-board');
    if (boardEl) {
      let html = '<div class="tft-board-cols"><span>Front</span><span></span><span></span><span>Back</span></div>';
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const u = p.board[r][c];
          const front = c === 0 ? ' is-front' : '';
          const back = c === COLS - 1 ? ' is-back' : '';
          const sel = selected?.area === 'board' && selected.r === r && selected.c === c ? ' is-selected' : '';
          html += `<div class="tft-board-cell${u ? ' has-unit' : ''}${front}${back}${sel}" data-r="${r}" data-c="${c}" title="${c === 0 ? 'Frontline (near mid)' : c === COLS - 1 ? 'Backline' : ''}">`;
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
          if (u) html += unitChipHtml(u);
          html += '</div>';
        }
      }
      oppBoard.innerHTML = html;
    }

    const benchEl = $('tft-bench');
    if (benchEl) {
      benchEl.innerHTML = p.bench.map((u, i) => {
        const sel = selected?.area === 'bench' && selected.idx === i ? ' is-selected' : '';
        return `<div class="tft-bench-slot${u ? ' has-unit' : ''}${sel}" data-bench="${i}">${u ? unitChipHtml(u) : ''}</div>`;
      }).join('');
    }

    const traitsEl = $('tft-traits');
    if (traitsEl) {
      const counts = traitCounts(p);
      traitsEl.innerHTML = Object.entries(TRAITS).map(([id, tr]) => {
        const n = counts[id] || 0;
        const on = n >= tr.breakpoints[0];
        const next = tr.breakpoints.find((b) => n < b) || tr.breakpoints[tr.breakpoints.length - 1];
        return `<div class="tft-trait${on ? ' is-active' : ''}" data-trait="${id}">`
          + `<span class="tft-trait-name">${escapeHtml(tr.name)}</span>`
          + `<span class="tft-trait-count">${n}/${next}</span>`
          + `<span class="tft-trait-desc">${escapeHtml(tr.desc)}</span>`
          + `<span class="tft-trait-tiers">${escapeHtml((tr.tiers || []).join(' · '))}</span>`
          + `</div>`;
      }).join('');
    }

    renderInspectPanel();

    const readyBtn = $('tft-ready-btn');
    if (readyBtn) {
      readyBtn.disabled = !planning;
      if (state.phase === 'combat') readyBtn.textContent = 'Fighting…';
      else if (state.phase === 'result') readyBtn.textContent = 'Round done';
      else readyBtn.textContent = p.ready ? 'Waiting…' : 'Ready';
      readyBtn.classList.toggle('is-waiting', planning && p.ready);
    }
    if ($('tft-reroll-btn')) $('tft-reroll-btn').disabled = !planning || p.ready || p.gold < REROLL;
    if ($('tft-xp-btn')) $('tft-xp-btn').disabled = !planning || p.ready || p.gold < XP_COST || p.level >= MAX_LEVEL;
  }

  // ─── Combat / arena draw (sprites) ─────────────────────────────────────────

  function drawArenaBackground() {
    const layout = arenaLayout();
    const { w, h, mid, padX, padY } = layout;
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = '#10241c';
    ctx.fillRect(0, 0, mid, h);
    ctx.fillStyle = '#241610';
    ctx.fillRect(mid, 0, mid, h);

    ctx.fillStyle = 'rgba(78,205,196,0.08)';
    ctx.fillRect(padX, padY, mid - padX - 20, h - padY * 2);
    ctx.fillStyle = 'rgba(255,142,83,0.08)';
    ctx.fillRect(mid + 20, padY, mid - padX - 20, h - padY * 2);

    ctx.strokeStyle = 'rgba(240,216,120,0.45)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 10]);
    ctx.beginPath();
    ctx.moveTo(mid, 20);
    ctx.lineTo(mid, h - 20);
    ctx.stroke();
    ctx.setLineDash([]);

    const leftTag = match.playerId === 0 ? `${state.players[0].name} (YOU)` : state.players[0].name;
    const rightTag = match.playerId === 1 ? `${state.players[1].name} (YOU)` : state.players[1].name;
    ctx.font = '800 14px Orbitron, Rajdhani, sans-serif';
    ctx.fillStyle = '#4ECDC4';
    ctx.textAlign = 'left';
    ctx.fillText(`◀ ${leftTag}`, 14, 24);
    ctx.fillStyle = '#FF8E53';
    ctx.textAlign = 'right';
    ctx.fillText(`${rightTag} ▶`, w - 14, 24);
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(240,216,120,0.75)';
    ctx.font = '700 11px Rajdhani, sans-serif';
    ctx.fillText('LEFT  ·  VS  ·  RIGHT', mid, 24);
    ctx.textAlign = 'left';
    return layout;
  }

  function drawPortraitFallback(u, sz) {
    const rad = Math.max(14, sz * 0.62);
    const img = getPortrait(u.type);
    // Body plate so a unit is always visible even if the portrait is still loading.
    ctx.beginPath();
    ctx.arc(u.x, u.y, rad, 0, Math.PI * 2);
    ctx.fillStyle = u.color || '#94a3b8';
    ctx.fill();
    if (img.complete && img.naturalWidth) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(u.x, u.y, rad, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, u.x - rad, u.y - rad, rad * 2, rad * 2);
      ctx.restore();
    } else {
      ctx.fillStyle = '#0b120b';
      ctx.font = `700 ${Math.max(10, Math.floor(rad * 0.55))}px Orbitron, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText((u.name || u.type || '?').slice(0, 2).toUpperCase(), u.x, u.y + 1);
      ctx.textBaseline = 'alphabetic';
    }
  }

  function drawUnitSpriteAt(u, alpha = 1) {
    if (!ctx) return;
    const sz = Math.max(16, (u.size || 20) * (1 + ((u.star || 1) - 1) * 0.12));
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Always draw a portrait/body first so fights never look empty.
    drawPortraitFallback(u, sz);

    // Then try the real TDG sprite kit on top (optional).
    const drawFn = window.__TDG?.drawUnitOnContext;
    if (drawFn) {
      try {
        drawFn(ctx, u.type, u.x, u.y, u.facing, sz, {
          animT: u.animT || 0,
          moveSpeed: u.moveSpeed || 0,
          attackPhase: u.attackPhase || 'idle',
          attackProgress: u.attackProgress || 0,
          unitId: u.uid,
          ownerId: u.owner,
          hitFlash: u.hitFlash || 0,
        });
      } catch (err) {
        console.warn('TFT unit draw failed', u.type, err);
      }
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = u.owner === 0 ? '#4ECDC4' : '#FF8E53';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(u.x, u.y + 2, sz * 0.62, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#f0d878';
    ctx.font = '700 12px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(starLabel(u.star || 1), u.x, u.y - sz * 0.75 - 12);

    if (u.alive !== false && u.maxHp) {
      const bw = Math.max(36, sz * 1.15);
      const bx = u.x - bw / 2;
      const by = u.y - sz * 0.75 - 6;
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillRect(bx, by, bw, 6);
      ctx.fillStyle = u.owner === 0 ? '#4ECDC4' : '#FF8E53';
      ctx.fillRect(bx, by, bw * Math.max(0, Math.min(1, (u.hp ?? u.maxHp) / u.maxHp)), 6);
    }
    ctx.restore();
  }

  /** Idle placement preview during planning — same left/right sides as combat. */
  function drawPlanningPreview() {
    if (!ctx || !canvas || !state) return;
    const layout = drawArenaBackground();
    const ghost = [];
    for (let pid = 0; pid < 2; pid++) {
      const p = state.players[pid];
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const cell = p.board[r][c];
          if (!cell) continue;
          const st = scaledStats(cell.type, cell.star || 1);
          const pos = boardCellPos(pid, r, c, layout);
          ghost.push({
            uid: `preview-${pid}-${r}-${c}`,
            owner: pid,
            type: cell.type,
            star: cell.star || 1,
            size: st.size,
            x: pos.x,
            y: pos.y,
            facing: pid === 0 ? 0 : Math.PI,
            animT: performance.now() / 1000,
            moveSpeed: 0,
            attackPhase: 'idle',
            attackProgress: 0,
            alive: true,
            maxHp: st.hp,
            hp: st.hp,
          });
        }
      }
    }
    ghost.sort((a, b) => a.y - b.y).forEach((u) => drawUnitSpriteAt(u, u.owner === match.playerId ? 1 : 0.72));
    ctx.fillStyle = 'rgba(240,216,120,0.55)';
    ctx.font = '600 12px Rajdhani, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Formation preview — column 1 fights near mid', layout.w / 2, layout.h - 14);
    ctx.textAlign = 'left';
  }

  function drawCombat() {
    if (!ctx || !canvas) return;
    const layout = drawArenaBackground();
    const { w, h } = layout;

    const drawList = state.combatUnits.slice().sort((a, b) => a.y - b.y);
    for (const u of drawList) {
      const alpha = u.alive ? 1 : Math.max(0, 1 - u.deathT);
      if (alpha <= 0.02) continue;
      drawUnitSpriteAt(u, alpha);
    }

    for (const p of state.projectiles) {
      ctx.fillStyle = p.color || '#fff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const f of state.floatTexts) {
      ctx.globalAlpha = Math.max(0, f.life);
      ctx.fillStyle = f.color || '#fff';
      ctx.font = '700 14px Orbitron, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(f.text, f.x, f.y);
      ctx.globalAlpha = 1;
    }

    if (state.combatFinished && state.pendingResult) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, h * 0.4, w, 52);
      ctx.fillStyle = '#f0d878';
      ctx.font = '700 22px Orbitron, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${state.players[state.pendingResult.winner]?.name || 'Winner'} wins the fight`, w / 2, h * 0.4 + 34);
      ctx.textAlign = 'left';
    }
  }

  function resizeCanvas() {
    if (!canvas) return;
    const wrap = canvas.parentElement;
    const rect = wrap?.getBoundingClientRect();
    const w = Math.max(360, Math.floor(rect?.width || 800));
    const h = Math.max(240, Math.floor(rect?.height || 380));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }

  function tick(dt) {
    if (!active || !state) return;
    if (state.phase === 'planning') {
      drawPlanningPreview();
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
      if (!btn || state?.phase !== 'planning') return;
      const idx = Number(btn.getAttribute('data-shop'));
      selected = { area: 'shop', idx };
      if (!me().ready) tryBuy(idx);
      renderHud();
    });
    $('tft-reroll-btn')?.addEventListener('click', () => tryReroll());
    $('tft-xp-btn')?.addEventListener('click', () => tryBuyXp());
    $('tft-ready-btn')?.addEventListener('click', () => {
      if (!me().ready) setReady(true);
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
      const board = e.target.closest?.('#tft-board .tft-board-cell');
      if (board?.querySelector('.tft-unit-chip')) {
        e.preventDefault();
        trySell({ area: 'board', r: Number(board.dataset.r), c: Number(board.dataset.c) });
        return;
      }
      const bench = e.target.closest?.('#tft-bench [data-bench]');
      if (bench?.querySelector('.tft-unit-chip')) {
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
      players: [freshPlayer(0, match.player0Name), freshPlayer(1, match.player1Name)],
      combatUnits: [],
      projectiles: [],
      floatTexts: [],
      messages: [],
      combatFinished: false,
      resultApplied: false,
    };
    selected = null;
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
      try {
        tick(dt);
      } catch (err) {
        console.warn('TFT tick error', err);
      }
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
