/**
 * Farmers — a peaceful, slow-and-steady farm market mode for Block Fortress / TDG.
 *
 * Both players share the Local Game map, one territory each, and never fight.
 * You unlock seeds at your shop, cover your land in farms, hire farmhands to
 * carry produce to your stand, and sell to wandering units. Money only goes up.
 *
 * Host-authoritative over Pusher (same path as TFT / Online PvP): the host ticks
 * the whole valley and publishes full match state; the guest only renders and
 * sends actions. Every match has one shared gameId (the PvP room id / ?game=).
 * Solo play is just a host with an empty neighbouring stall.
 */
(function () {
  'use strict';

  // ─── Map geometry (mirrors the Local Game arena) ──────────────────────────
  const W = 1280;
  const H = 720;
  const LAND_TOP = Math.round(H * 0.22);
  const LAND_BOTTOM = H - 28;
  const MID_Y = Math.round((LAND_TOP + LAND_BOTTOM) / 2);

  /** Central dirt road the customers travel along. */
  const ROAD_X = W / 2;
  const ROAD_HALF = 78;

  const FARM_COLS = 4;
  const FARM_ROWS = 6;
  const FARM_SLOTS = FARM_COLS * FARM_ROWS;
  const FARM_SIZE = 38;

  const START_GOLD = 60;
  const AUTH_SYNC_MS = 220;
  const PERSIST_MS = 6000;
  /** Fraction of the last plot cost returned when you sell a farm. */
  const SELL_REFUND = 0.6;
  /** Buy the neighbour's whole farm for this much and you win the valley. */
  const BUYOUT_COST = 1000000;

  // ─── Farm ladder — later seeds cost far more and sell for far more ────────
  const FARM_TYPES = [
    { id: 'wheat', name: 'Wheat', emoji: '🌾', crops: ['🌾'], unlock: 0, cost: 35, grow: 3.4, price: 2 },
    { id: 'carrot', name: 'Carrots', emoji: '🥕', crops: ['🥕'], unlock: 130, cost: 75, grow: 3.7, price: 4 },
    { id: 'corn', name: 'Corn', emoji: '🌽', crops: ['🌽'], unlock: 360, cost: 160, grow: 4.0, price: 8 },
    { id: 'tomato', name: 'Tomatoes', emoji: '🍅', crops: ['🍅'], unlock: 950, cost: 340, grow: 4.3, price: 15 },
    { id: 'berry', name: 'Strawberries', emoji: '🍓', crops: ['🍓'], unlock: 2400, cost: 720, grow: 4.6, price: 28 },
    { id: 'pepper', name: 'Peppers', emoji: '🫑', crops: ['🫑', '🍆'], unlock: 5800, cost: 1500, grow: 5.0, price: 52 },
    { id: 'melon', name: 'Melons', emoji: '🍈', crops: ['🍈', '🍉'], unlock: 14000, cost: 3200, grow: 5.4, price: 95 },
    { id: 'sunflower', name: 'Golden Sunflowers', emoji: '🌻', crops: ['🌻'], unlock: 34000, cost: 6800, grow: 5.8, price: 180 },
  ];
  const FARM_BY_ID = {};
  for (const t of FARM_TYPES) FARM_BY_ID[t.id] = t;

  /** Each extra farm of a type costs more than the last. */
  const FARM_COST_GROWTH = 1.11;

  /** Money tree in the middle of the valley — either farmer can shake it for coins. */
  const TREE_X = ROAD_X;
  const TREE_Y = MID_Y - 58;
  const TREE_RADIUS = 52;
  const TREE_CLICK_REWARD = 1;

  // ─── Per-farm-type skill tree: three branches, three tiers each ───────────
  const FARM_BRANCHES = [
    { id: 'growth', name: 'Growth', icon: '⏱️', blurb: 'Harvest arrives sooner' },
    { id: 'yield', name: 'Yield', icon: '🧺', blurb: 'More produce per harvest' },
    { id: 'quality', name: 'Quality', icon: '✨', blurb: 'Produce sells for more' },
  ];
  const BRANCH_MAX = 3;
  const BRANCH_TIER_COSTS = [1.1, 3.2, 8.5];
  const GROWTH_PER_TIER = 0.7;
  /** A plot always comes up with a proper armful, not a single crop. */
  const YIELD_BASE = 3;
  const YIELD_PER_TIER = 2;
  const QUALITY_PER_TIER = 0.3;

  // ─── Helpers (each type hauls more than the last) ──────────────────────────
  const WORKER_TYPES = [
    { id: 'farmer', name: 'Farmhand', emoji: '🧑‍🌾', sprite: 'farmer', cost: 60, growth: 1.22, speed: 72, carry: 4, size: 20 },
    { id: 'goblin', name: 'Goblin Hauler', emoji: '👺', sprite: 'goblin', cost: 150, growth: 1.24, speed: 94, carry: 6, size: 18 },
    { id: 'swordsman', name: 'Swordsman', emoji: '⚔️', sprite: 'swordsman', cost: 360, growth: 1.26, speed: 78, carry: 9, size: 21 },
    { id: 'bowman', name: 'Archer Runner', emoji: '🏹', sprite: 'bowman', cost: 820, growth: 1.28, speed: 88, carry: 12, size: 20 },
    { id: 'wolf_hunter', name: 'Hunter', emoji: '🗡️', sprite: 'wolf_hunter', cost: 1800, growth: 1.3, speed: 102, carry: 16, size: 24 },
    { id: 'yeti', name: 'Yeti Porter', emoji: '🧊', sprite: 'yeti', cost: 4000, growth: 1.32, speed: 66, carry: 24, size: 28 },
    { id: 'tank', name: 'Elephant', emoji: '🐘', sprite: 'tank', cost: 9000, growth: 1.34, speed: 50, carry: 34, size: 30 },
    { id: 'peka', name: 'Dragon', emoji: '🐉', sprite: 'peka', cost: 21000, growth: 1.36, speed: 86, carry: 48, size: 32 },
  ];
  const WORKER_BY_ID = {};
  for (const w of WORKER_TYPES) WORKER_BY_ID[w.id] = w;
  const MAX_WORKERS = 16;
  const WORKER_SKILL_MAX = 3;
  const WORKER_SPEED_PER_TIER = 0.18;
  const WORKER_CARRY_PER_TIER = 2;
  const WORKER_SKILL_COSTS = [1.2, 3.5, 9];

  const DOG_BASE_COST = 200;
  const DOG_COST_GROWTH = 1.4;
  const MAX_DOGS = 4;
  /** Each dog makes every helper this much quicker. */
  const DOG_SPEED_BONUS = 0.12;

  // ─── Stand ────────────────────────────────────────────────────────────────
  const STAND_UPGRADES = [320, 950, 2800, 7600];
  const STAND_BASE_STOCK = 18;
  const STAND_STOCK_PER_LEVEL = 14;
  const STAND_BASE_CUSTOMER_GAP = 5.0;
  /** A fuller stand pulls a bigger crowd off the road. */
  const STAND_CROWD_PULL = 0.11;
  const MAX_CUSTOMERS = 16;

  // ─── Customers are units from the main game ───────────────────────────────
  const CUSTOMER_TYPES = [
    { type: 'swordsman', name: 'Swordsman', want: 2, size: 21, tip: 1 },
    { type: 'striker', name: 'Knight', want: 3, size: 22, tip: 1.05 },
    { type: 'bowman', name: 'Archer', want: 2, size: 20, tip: 1 },
    { type: 'sniper', name: 'Sniper', want: 3, size: 19, tip: 1.1 },
    { type: 'goblin', name: 'Goblin', want: 1, size: 18, tip: 0.95 },
    { type: 'speed', name: 'Wolf', want: 1, size: 19, tip: 0.95 },
    { type: 'wolf_hunter', name: 'Hunter', want: 4, size: 25, tip: 1.15 },
    { type: 'yeti', name: 'Yeti', want: 5, size: 29, tip: 1.2 },
    { type: 'angel', name: 'Angel', want: 4, size: 23, tip: 1.25 },
    { type: 'tank', name: 'Elephant', want: 6, size: 26, tip: 1.2 },
    { type: 'peka', name: 'Dragon', want: 8, size: 28, tip: 1.4 },
  ];

  // ─── Runtime ──────────────────────────────────────────────────────────────
  let active = false;
  let cfg = null;
  /** Shared match: { players: [p0, p1], elapsed }. */
  let match = null;
  let me = null;
  let peer = null;
  let canvas = null;
  let ctx = null;
  let raf = 0;
  let lastTs = 0;
  let clock = 0;
  let lastAuthPublishAt = 0;
  let lastPersistAt = 0;
  let lastPanelAt = -99;
  let selectedSeed = 'wheat';
  let treeType = 'wheat';
  let selectedHelper = 'farmer';
  let helperTreeType = 'farmer';
  let activeSheet = null;
  let sellMode = false;
  let uiBound = false;
  let hudDirty = true;
  let gotAuthSnapshot = false;
  /** Shake/leaf state for the shared money tree, plus the floating "+$1" coins. */
  let moneyTree = { shake: 0, sway: 0, clicks: 0, leaves: [] };
  let floaters = [];

  function $(id) {
    return document.getElementById(id);
  }

  function show(el) {
    el?.classList.remove('hidden');
  }

  function hide(el) {
    el?.classList.add('hidden');
  }

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  function money(n) {
    const v = Math.floor(n || 0);
    return `$${v.toLocaleString('en-US')}`;
  }

  function mintSoloGameId() {
    const rand = Math.random().toString(36).slice(2, 8);
    return `farm-${Date.now().toString(36)}-${rand}`;
  }

  function shortGameId(id) {
    const s = String(id || '');
    if (s.length <= 18) return s || '—';
    return `${s.slice(0, 8)}…${s.slice(-6)}`;
  }

  /** roundRect isn't in every engine we ship to. */
  function roundRect(x, y, w, h, r) {
    if (typeof ctx.roundRect === 'function') {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      return;
    }
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ─── Territory layout ─────────────────────────────────────────────────────
  /** Farms fill the outer half of a side; the stand faces the central road. */
  function sideLayout(slot) {
    const left = slot === 0;
    return {
      left,
      standX: left ? ROAD_X - ROAD_HALF - 62 : ROAD_X + ROAD_HALF + 62,
      standY: MID_Y + 24,
      shopX: left ? ROAD_X - ROAD_HALF - 62 : ROAD_X + ROAD_HALF + 62,
      shopY: LAND_TOP + 58,
      farmX0: left ? 62 : W - 62,
      dir: left ? 1 : -1,
    };
  }

  function slotPosition(slot, index) {
    const lay = sideLayout(slot);
    const col = index % FARM_COLS;
    const row = Math.floor(index / FARM_COLS);
    const gapX = 108;
    const gapY = (LAND_BOTTOM - 66 - (LAND_TOP + 92)) / (FARM_ROWS - 1);
    return {
      x: lay.farmX0 + lay.dir * col * gapX,
      y: LAND_TOP + 92 + row * gapY,
    };
  }

  // ─── Player state ─────────────────────────────────────────────────────────
  function freshTree() {
    const tree = {};
    for (const t of FARM_TYPES) tree[t.id] = { growth: 0, yield: 0, quality: 0 };
    return tree;
  }

  function freshWorkerSkills() {
    const tree = {};
    for (const w of WORKER_TYPES) tree[w.id] = { speed: 0, carry: 0 };
    return tree;
  }

  function freshWorker(x, y, typeId) {
    return {
      type: typeId || 'farmer',
      x,
      y,
      state: 'idle',
      target: -1,
      carry: [],
      animT: Math.random() * 4,
      facing: 0,
      moving: 0,
    };
  }

  function freshPlayer(name, slot) {
    const lay = sideLayout(slot);
    return {
      name: name || (slot === 0 ? 'Farmer' : 'Rival'),
      slot,
      gold: START_GOLD,
      earned: 0,
      sold: 0,
      unlocked: { wheat: true },
      tree: freshTree(),
      workerSkills: freshWorkerSkills(),
      hired: { farmer: 1 },
      placed: {},
      farms: [],
      farmers: [freshWorker(lay.standX, lay.standY - 10, 'farmer')],
      dogs: [],
      stand: { level: 0, stock: [], customerAcc: 2 },
      customers: [],
      hint: 'Open Seeds below, plant Wheat, hire helpers, and race to $1,000,000.',
    };
  }

  // ─── Derived stats ────────────────────────────────────────────────────────
  function growInterval(p, typeId) {
    const def = FARM_BY_ID[typeId];
    const tier = p.tree[typeId]?.growth || 0;
    return Math.max(1.2, def.grow - tier * GROWTH_PER_TIER);
  }

  function yieldPer(p, typeId) {
    return YIELD_BASE + (p.tree[typeId]?.yield || 0) * YIELD_PER_TIER;
  }

  function unitPrice(p, typeId) {
    const def = FARM_BY_ID[typeId];
    const quality = 1 + (p.tree[typeId]?.quality || 0) * QUALITY_PER_TIER;
    const standBonus = 1 + p.stand.level * 0.05;
    return def.price * quality * standBonus;
  }

  function nextFarmCost(p, typeId) {
    const def = FARM_BY_ID[typeId];
    const count = p.placed[typeId] || 0;
    return Math.round(def.cost * Math.pow(FARM_COST_GROWTH, count));
  }

  function branchCost(typeId, branchId, tier) {
    const def = FARM_BY_ID[typeId];
    const mult = BRANCH_TIER_COSTS[tier] || BRANCH_TIER_COSTS[BRANCH_TIER_COSTS.length - 1];
    const base = Math.max(def.cost, def.price * 22);
    const branchWeight = branchId === 'quality' ? 1.35 : 1;
    return Math.round(base * mult * branchWeight);
  }

  function workerHireCost(p, typeId) {
    const def = WORKER_BY_ID[typeId];
    if (!def) return null;
    const count = p.hired?.[typeId] || 0;
    return Math.round(def.cost * Math.pow(def.growth, count));
  }

  function dogCost(p) {
    return Math.round(DOG_BASE_COST * Math.pow(DOG_COST_GROWTH, p.dogs.length));
  }

  function workerSkillCost(typeId, branchId, tier) {
    const def = WORKER_BY_ID[typeId];
    if (!def || tier >= WORKER_SKILL_MAX) return null;
    const mult = WORKER_SKILL_COSTS[tier] || WORKER_SKILL_COSTS[WORKER_SKILL_COSTS.length - 1];
    const weight = branchId === 'carry' ? 1.25 : 1;
    return Math.round(def.cost * mult * weight * 0.55);
  }

  function workerSpeed(p, worker) {
    const def = WORKER_BY_ID[worker.type] || WORKER_TYPES[0];
    const tier = p.workerSkills?.[worker.type]?.speed || 0;
    const base = def.speed * (1 + tier * WORKER_SPEED_PER_TIER);
    return base * (1 + p.dogs.length * DOG_SPEED_BONUS);
  }

  function workerCapacity(p, worker) {
    const def = WORKER_BY_ID[worker.type] || WORKER_TYPES[0];
    const tier = p.workerSkills?.[worker.type]?.carry || 0;
    return def.carry + tier * WORKER_CARRY_PER_TIER;
  }

  function standCapacity(p) {
    return STAND_BASE_STOCK + p.stand.level * STAND_STOCK_PER_LEVEL;
  }

  /**
   * Word gets around: the fuller the stand looks, the shorter the wait between
   * customers wandering over to check it out. An empty stand is nearly ignored.
   */
  function customerGap(p) {
    const base = Math.max(1.4, STAND_BASE_CUSTOMER_GAP - p.stand.level * 0.7);
    const stock = p.stand.stock.length;
    if (stock <= 0) return base * 2.4;
    return Math.max(0.35, base / (1 + stock * STAND_CROWD_PULL));
  }

  /** How big a crowd the stand can hold at once, again driven by what's on display. */
  function customerCap(p) {
    const stock = p.stand.stock.length;
    return clamp(3 + p.stand.level * 2 + Math.floor(stock / 2), 3, MAX_CUSTOMERS);
  }

  /** Plots should always look planted; yield upgrades fill them in further. */
  function densityFor(p, typeId) {
    return clamp(2 + (p.tree[typeId]?.yield || 0), 2, 4);
  }

  function isAuthority() {
    return !!(cfg && (cfg.isHost || cfg.solo));
  }

  function rebindPlayers() {
    if (!match?.players) {
      me = null;
      peer = null;
      return;
    }
    const slot = cfg?.myPlayerId === 1 ? 1 : 0;
    me = match.players[slot] || null;
    peer = match.players[slot === 0 ? 1 : 0] || null;
  }

  /** Gold returned for selling one farm of this type (based on last purchase cost). */
  function farmSellValue(p, typeId) {
    const def = FARM_BY_ID[typeId];
    const count = p.placed[typeId] || 0;
    if (!def || count <= 0) return 0;
    const lastCost = Math.round(def.cost * Math.pow(FARM_COST_GROWTH, count - 1));
    return Math.max(1, Math.floor(lastCost * SELL_REFUND));
  }

  function occupiedFarmNear(p, x, y) {
    let best = null;
    let bestD = Infinity;
    for (const farm of p.farms) {
      const pos = slotPosition(p.slot, farm.slot);
      const d = Math.hypot(pos.x - x, pos.y - y);
      if (d < bestD) {
        bestD = d;
        best = farm;
      }
    }
    return best && bestD <= 48 ? { farm: best, dist: bestD } : null;
  }

  // ─── Simulation ───────────────────────────────────────────────────────────
  function freeSlotNear(p, x, y) {
    const used = new Set(p.farms.map((f) => f.slot));
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < FARM_SLOTS; i++) {
      if (used.has(i)) continue;
      const pos = slotPosition(p.slot, i);
      const d = (pos.x - x) ** 2 + (pos.y - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return { slot: best, dist: Math.sqrt(bestD) };
  }

  function moveToward(ent, tx, ty, speed, dt) {
    const dx = tx - ent.x;
    const dy = ty - ent.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.5) return true;
    ent.facing = Math.atan2(dy, dx);
    const step = speed * dt;
    if (dist <= step) {
      ent.x = tx;
      ent.y = ty;
      return true;
    }
    ent.x += (dx / dist) * step;
    ent.y += (dy / dist) * step;
    return false;
  }

  /**
   * Real farming: a plot grows once, then the ripe crop sits in the field until
   * a farmhand picks it. Nothing regrows on unharvested ground, so the farm only
   * moves as fast as the hands you've hired to work it.
   */
  function tickFarms(p, dt) {
    for (const farm of p.farms) {
      if (farm.ready > 0) {
        farm.progress = 1;
        continue;
      }
      const interval = growInterval(p, farm.type);
      farm.acc += dt;
      if (farm.acc >= interval) {
        farm.acc = 0;
        farm.ready = yieldPer(p, farm.type);
        farm.progress = 1;
      } else {
        farm.progress = clamp(farm.acc / interval, 0, 0.999);
      }
    }
  }

  function pickFarmFor(p, farmer) {
    const claimed = new Set(
      p.farmers.filter((f) => f !== farmer && f.target >= 0).map((f) => f.target),
    );
    let best = -1;
    let bestScore = -Infinity;
    for (let i = 0; i < p.farms.length; i++) {
      const farm = p.farms[i];
      if (!farm.ready) continue;
      if (claimed.has(i)) continue;
      const pos = slotPosition(p.slot, farm.slot);
      const dist = Math.hypot(pos.x - farmer.x, pos.y - farmer.y);
      const score = farm.ready * 40 - dist;
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    }
    return best;
  }

  function tickFarmers(p, dt) {
    const lay = sideLayout(p.slot);
    for (const farmer of p.farmers) {
      if (!farmer.type) farmer.type = 'farmer';
      const before = { x: farmer.x, y: farmer.y };
      const speed = workerSpeed(p, farmer);
      const cap = workerCapacity(p, farmer);

      if (farmer.state === 'idle') {
        const idx = farmer.carry.length >= cap ? -1 : pickFarmFor(p, farmer);
        if (idx >= 0) {
          farmer.state = 'to_farm';
          farmer.target = idx;
        } else if (farmer.carry.length) {
          farmer.state = 'to_stand';
        }
      } else if (farmer.state === 'to_farm') {
        const farm = p.farms[farmer.target];
        if (!farm || !farm.ready) {
          farmer.state = farmer.carry.length ? 'to_stand' : 'idle';
          farmer.target = -1;
        } else {
          const pos = slotPosition(p.slot, farm.slot);
          if (moveToward(farmer, pos.x, pos.y + 16, speed, dt)) {
            const room = cap - farmer.carry.length;
            const take = Math.min(room, farm.ready);
            const value = unitPrice(p, farm.type);
            for (let i = 0; i < take; i++) farmer.carry.push({ v: value, e: farm.type });
            farm.ready -= take;
            if (farm.ready <= 0) {
              farm.ready = 0;
              farm.acc = 0;
              farm.progress = 0;
            }
            farmer.target = -1;
            farmer.state = farmer.carry.length >= cap ? 'to_stand' : 'idle';
          }
        }
      } else if (farmer.state === 'to_stand') {
        if (moveToward(farmer, lay.standX - lay.dir * 22, lay.standY - 6, speed, dt)) {
          const room = standCapacity(p) - p.stand.stock.length;
          const drop = Math.min(room, farmer.carry.length);
          for (let i = 0; i < drop; i++) p.stand.stock.push(farmer.carry.pop());
          farmer.state = 'idle';
        }
      }

      const moved = Math.hypot(farmer.x - before.x, farmer.y - before.y);
      farmer.moving = moved > 0.05 ? 1 : 0;
      farmer.animT = (farmer.animT || 0) + dt;
    }

    for (let i = 0; i < p.dogs.length; i++) {
      const dog = p.dogs[i];
      const host = p.farmers[i % p.farmers.length];
      if (!host) continue;
      const offset = (i % 2 === 0 ? -1 : 1) * 20;
      moveToward(dog, host.x + offset, host.y + 14, workerSpeed(p, host) * 1.2, dt);
      dog.animT = (dog.animT || 0) + dt;
    }
  }

  function tickCustomers(p, dt) {
    const lay = sideLayout(p.slot);
    p.stand.customerAcc -= dt;
    if (p.stand.customerAcc <= 0 && p.customers.length < customerCap(p)) {
      p.stand.customerAcc = customerGap(p) * (0.75 + Math.random() * 0.5);
      p.customers.push(spawnCustomer(p));
    }

    for (let i = p.customers.length - 1; i >= 0; i--) {
      const c = p.customers[i];
      if (c.state === 'arrive') {
        if (moveToward(c, ROAD_X + (lay.left ? -18 : 18), lay.standY + 46 + c.lane, c.speed, dt)) {
          c.state = 'queue';
        }
      } else if (c.state === 'queue') {
        if (moveToward(c, lay.standX + lay.dir * 30, lay.standY + 26 + c.lane * 0.5, c.speed, dt)) {
          c.state = 'buying';
          c.timer = 0.8 + Math.random() * 0.7;
        }
      } else if (c.state === 'buying') {
        c.timer -= dt;
        if (c.timer <= 0) {
          const take = Math.min(c.want, p.stand.stock.length);
          if (take > 0) {
            let pay = 0;
            for (let n = 0; n < take; n++) {
              const item = p.stand.stock.pop();
              pay += (item?.v || 1) * c.tip;
            }
            p.gold += pay;
            p.earned += pay;
            p.sold += take;
            c.bought = take;
            addFloater(c.x, c.y - c.size * 0.9, `+${money(pay)}`, '#bff5c0');
            hudDirty = true;
          }
          c.state = 'leave';
        }
      } else if (c.state === 'leave') {
        if (moveToward(c, ROAD_X + c.lane * 0.8, LAND_BOTTOM + 44, c.speed * 1.1, dt)) {
          p.customers.splice(i, 1);
          continue;
        }
      }
      c.animT = (c.animT || 0) + dt;
    }
  }

  /** Richer, fuller stands attract the bigger-spending units. */
  function spawnCustomer(p) {
    const display = Math.floor(p.stand.stock.length / 8);
    const reach = clamp(
      2 + p.stand.level * 2 + display + Math.floor(p.sold / 60),
      2,
      CUSTOMER_TYPES.length,
    );
    const def = CUSTOMER_TYPES[Math.floor(Math.random() * reach)];
    // Everyone walks in off the bottom of the road so nobody pops in mid-field.
    return {
      type: def.type,
      want: def.want,
      tip: def.tip,
      size: def.size,
      x: ROAD_X + (Math.random() - 0.5) * 60,
      y: LAND_BOTTOM + 34,
      speed: 54 + Math.random() * 18,
      state: 'arrive',
      timer: 0,
      facing: 0,
      lane: (Math.random() - 0.5) * 74,
      animT: Math.random() * 3,
    };
  }

  // ─── Money tree ───────────────────────────────────────────────────────────
  function addFloater(x, y, text, color) {
    if (floaters.length > 40) floaters.shift();
    floaters.push({ x, y, text, color: color || '#ffe9a8', life: 1 });
  }

  function tickExtras(dt) {
    moneyTree.sway += dt;
    moneyTree.shake = Math.max(0, moneyTree.shake - dt * 3.4);
    for (let i = moneyTree.leaves.length - 1; i >= 0; i--) {
      const leaf = moneyTree.leaves[i];
      leaf.life -= dt * 0.9;
      leaf.x += leaf.vx * dt;
      leaf.y += leaf.vy * dt;
      leaf.vy += 26 * dt;
      leaf.spin += leaf.vs * dt;
      if (leaf.life <= 0) moneyTree.leaves.splice(i, 1);
    }
    for (let i = floaters.length - 1; i >= 0; i--) {
      const f = floaters[i];
      f.life -= dt * 1.3;
      f.y -= 26 * dt;
      if (f.life <= 0) floaters.splice(i, 1);
    }
  }

  // ─── Actions (host applies; guests send over Pusher) ───────────────────────
  function setHintFor(p, text) {
    if (!p) return;
    p.hint = text;
    if (p === me) {
      const el = $('farmers-hint');
      if (el) el.textContent = text;
    }
  }

  function setHint(text) {
    setHintFor(me, text);
  }

  function applyPlaceFarm(p, x, y, seedId) {
    const typeId = seedId || selectedSeed;
    const def = FARM_BY_ID[typeId];
    if (!def || !p.unlocked[def.id]) {
      setHintFor(p, 'Unlock that seed at your shop first.');
      return false;
    }
    const cost = nextFarmCost(p, def.id);
    if (p.gold < cost) {
      setHintFor(p, `${def.name} costs ${money(cost)} — keep selling.`);
      return false;
    }
    const spot = freeSlotNear(p, x, y);
    if (spot.slot < 0) {
      setHintFor(p, 'Your land is full of farms.');
      return false;
    }
    if (spot.dist > 150) {
      setHintFor(p, 'Click your own side of the road to plant.');
      return false;
    }
    p.gold -= cost;
    p.placed[def.id] = (p.placed[def.id] || 0) + 1;
    p.farms.push({ slot: spot.slot, type: def.id, acc: 0, ready: 0, progress: 0 });
    setHintFor(p, `${def.name} planted. Next one costs ${money(nextFarmCost(p, def.id))}.`);
    hudDirty = true;
    return true;
  }

  function applySellFarm(p, slotIndex) {
    const idx = p.farms.findIndex((f) => f.slot === slotIndex);
    if (idx < 0) {
      setHintFor(p, 'No farm on that plot.');
      return false;
    }
    const farm = p.farms[idx];
    const refund = farmSellValue(p, farm.type);
    const def = FARM_BY_ID[farm.type] || FARM_TYPES[0];
    p.farms.splice(idx, 1);
    p.placed[farm.type] = Math.max(0, (p.placed[farm.type] || 1) - 1);
    p.gold += refund;
    // Farmhands aiming at a later index need their target shifted; clear all.
    for (const farmer of p.farmers) {
      farmer.target = -1;
      if (farmer.state === 'to_farm') farmer.state = farmer.carry.length ? 'to_stand' : 'idle';
    }
    const pos = slotPosition(p.slot, farm.slot);
    addFloater(pos.x, pos.y - 20, `+${money(refund)}`, '#ffe08a');
    setHintFor(p, `Sold ${def.name} plot for ${money(refund)}.`);
    hudDirty = true;
    return true;
  }

  function applyUnlockSeed(p, typeId) {
    const def = FARM_BY_ID[typeId];
    if (!def || p.unlocked[typeId]) return false;
    if (p.gold < def.unlock) {
      setHintFor(p, `${def.name} seeds cost ${money(def.unlock)}.`);
      return false;
    }
    p.gold -= def.unlock;
    p.unlocked[typeId] = true;
    if (p === me) {
      selectedSeed = typeId;
      treeType = typeId;
    }
    setHintFor(p, `${def.name} unlocked — sells for ${money(def.price)} each.`);
    hudDirty = true;
    return true;
  }

  function applyBuyBranch(p, typeId, branchId) {
    if (!p.unlocked[typeId]) return false;
    const rec = p.tree[typeId];
    const tier = rec[branchId] || 0;
    if (tier >= BRANCH_MAX) return false;
    const cost = branchCost(typeId, branchId, tier);
    if (p.gold < cost) {
      setHintFor(p, `That upgrade costs ${money(cost)}.`);
      return false;
    }
    p.gold -= cost;
    rec[branchId] = tier + 1;
    const def = FARM_BY_ID[typeId];
    setHintFor(p, `${def.name} ${branchId} upgraded to ${rec[branchId]}/${BRANCH_MAX}.`);
    hudDirty = true;
    return true;
  }

  function applyHireWorker(p, typeId) {
    const def = WORKER_BY_ID[typeId];
    if (!def) return false;
    if (p.farmers.length >= MAX_WORKERS) {
      setHintFor(p, 'Helper roster is full.');
      return false;
    }
    if (!p.hired) p.hired = {};
    if (!p.workerSkills) p.workerSkills = freshWorkerSkills();
    const cost = workerHireCost(p, typeId);
    if (p.gold < cost) {
      setHintFor(p, `${def.name} costs ${money(cost)}.`);
      return false;
    }
    const lay = sideLayout(p.slot);
    p.gold -= cost;
    p.hired[typeId] = (p.hired[typeId] || 0) + 1;
    p.farmers.push(freshWorker(lay.standX - lay.dir * 30, lay.standY + 8, typeId));
    setHintFor(p, `${def.name} hired — carries ${workerCapacity(p, { type: typeId })} crops (${p.farmers.length}/${MAX_WORKERS}).`);
    hudDirty = true;
    return true;
  }

  function applyWorkerBranch(p, typeId, branchId) {
    const def = WORKER_BY_ID[typeId];
    if (!def) return false;
    if (!p.workerSkills) p.workerSkills = freshWorkerSkills();
    if (!p.workerSkills[typeId]) p.workerSkills[typeId] = { speed: 0, carry: 0 };
    // Must own at least one of this helper type before training them.
    if (!(p.hired?.[typeId] > 0)) {
      setHintFor(p, `Hire a ${def.name} before training that skill tree.`);
      return false;
    }
    const tier = p.workerSkills[typeId][branchId] || 0;
    if (tier >= WORKER_SKILL_MAX) return false;
    const cost = workerSkillCost(typeId, branchId, tier);
    if (cost == null || p.gold < cost) {
      setHintFor(p, `That helper upgrade costs ${money(cost)}.`);
      return false;
    }
    p.gold -= cost;
    p.workerSkills[typeId][branchId] = tier + 1;
    setHintFor(p, `${def.name} ${branchId} → ${p.workerSkills[typeId][branchId]}/${WORKER_SKILL_MAX}.`);
    hudDirty = true;
    return true;
  }

  function applyBuyDog(p) {
    if (p.dogs.length >= MAX_DOGS) return false;
    const cost = dogCost(p);
    if (p.gold < cost) {
      setHintFor(p, `A farm dog costs ${money(cost)}.`);
      return false;
    }
    const lay = sideLayout(p.slot);
    p.gold -= cost;
    p.dogs.push({ x: lay.standX, y: lay.standY + 20, facing: 0, animT: 0 });
    setHintFor(p, 'A dog joins the farm — every farmhand moves quicker.');
    hudDirty = true;
    return true;
  }

  function applyUpgradeStand(p) {
    if (p.stand.level >= STAND_UPGRADES.length) return false;
    const cost = STAND_UPGRADES[p.stand.level];
    if (p.gold < cost) {
      setHintFor(p, `Stand upgrade costs ${money(cost)}.`);
      return false;
    }
    p.gold -= cost;
    p.stand.level += 1;
    setHintFor(p, 'Stand upgraded — busier customers, bigger shelves, better prices.');
    hudDirty = true;
    return true;
  }

  function applyShakeTree(p) {
    p.gold += TREE_CLICK_REWARD;
    p.earned += TREE_CLICK_REWARD;
    moneyTree.clicks += 1;
    moneyTree.shake = 1;
    hudDirty = true;
    addFloater(
      TREE_X + (Math.random() - 0.5) * 30,
      TREE_Y - 18 + (Math.random() - 0.5) * 16,
      `+${money(TREE_CLICK_REWARD)}`,
      '#ffe08a',
    );
    for (let i = 0; i < 3; i++) {
      moneyTree.leaves.push({
        x: TREE_X + (Math.random() - 0.5) * TREE_RADIUS * 1.2,
        y: TREE_Y - 12 + (Math.random() - 0.5) * 30,
        vx: (Math.random() - 0.5) * 40,
        vy: -10 - Math.random() * 20,
        spin: Math.random() * Math.PI,
        vs: (Math.random() - 0.5) * 6,
        life: 1,
      });
    }
    return true;
  }

  function rivalOf(slot) {
    return match?.players?.[slot === 0 ? 1 : 0] || null;
  }

  function canBuyout(p) {
    if (!match || match.ended || !p || p.gone || p.solo) return false;
    const rival = rivalOf(p.slot);
    if (!rival || rival.solo || rival.gone) return false;
    return p.gold >= BUYOUT_COST;
  }

  function showEndScreen() {
    const panel = $('farmers-end');
    if (!panel || !match?.ended) return;
    const winner = match.players[match.winnerSlot];
    const iWon = match.winnerSlot === cfg?.myPlayerId;
    const title = $('farmers-end-title');
    const body = $('farmers-end-body');
    if (title) title.textContent = iWon ? 'You own the valley' : 'Farm sold';
    if (body) {
      body.textContent = iWon
        ? `You bought ${rivalOf(cfg.myPlayerId)?.name || 'your neighbour'}'s farm for ${money(BUYOUT_COST)}.`
        : `${winner?.name || 'Your neighbour'} bought your farm for ${money(BUYOUT_COST)}.`;
    }
    show(panel);
  }

  function endMatch(winnerSlot) {
    if (!match || match.ended) return;
    match.ended = true;
    match.winnerSlot = winnerSlot;
    const winner = match.players[winnerSlot];
    const loser = rivalOf(winnerSlot);
    if (loser) loser.gone = true;
    setHintFor(winner, `Bought the neighbouring farm for ${money(BUYOUT_COST)}. You win!`);
    if (loser) setHintFor(loser, `${winner?.name || 'Your neighbour'} bought your farm. Game over.`);
    hudDirty = true;
    publishAuthState(true);
    showEndScreen();
    if (!cfg?.solo) {
      window.TDG_PVP?.notifyGameOver?.({
        winnerSlot,
        endReason: 'buyout',
      });
    }
  }

  function applyBuyout(p) {
    if (!canBuyout(p)) {
      if (p && p.gold < BUYOUT_COST) {
        setHintFor(p, `Buying their farm costs ${money(BUYOUT_COST)}. Keep selling.`);
      }
      return false;
    }
    p.gold -= BUYOUT_COST;
    endMatch(p.slot);
    return true;
  }

  /** Host-only mutation entry for every player action. */
  function applyAction(fromSlot, action) {
    if (!match || !action?.type) return false;
    if (match.ended && action.type !== 'farmers_request_sync') return false;
    const p = match.players[fromSlot];
    if (!p || p.gone) return false;
    const type = action.type;
    let ok = false;
    if (type === 'farmers_place_farm') {
      ok = applyPlaceFarm(p, Number(action.x), Number(action.y), action.seed);
    } else if (type === 'farmers_sell_farm') {
      ok = applySellFarm(p, Number(action.slot));
    } else if (type === 'farmers_unlock_seed') {
      ok = applyUnlockSeed(p, action.seed);
    } else if (type === 'farmers_buy_branch') {
      ok = applyBuyBranch(p, action.seed, action.branch);
    } else if (type === 'farmers_hire') {
      ok = applyHireWorker(p, action.worker || 'farmer');
    } else if (type === 'farmers_worker_branch') {
      ok = applyWorkerBranch(p, action.worker, action.branch);
    } else if (type === 'farmers_buy_dog') {
      ok = applyBuyDog(p);
    } else if (type === 'farmers_upgrade_stand') {
      ok = applyUpgradeStand(p);
    } else if (type === 'farmers_shake_tree') {
      ok = applyShakeTree(p);
    } else if (type === 'farmers_buyout') {
      ok = applyBuyout(p);
      // endMatch already published
      return ok;
    } else if (type === 'farmers_request_sync') {
      ok = true;
    } else {
      return false;
    }
    if (ok) publishAuthState(true);
    return ok;
  }

  function dispatchLocal(action) {
    if (!active || !cfg || !action) return;
    if (isAuthority()) {
      applyAction(cfg.myPlayerId, action);
      return;
    }
    // Guest: optimistic tree shake FX while waiting for the host snapshot.
    if (action.type === 'farmers_shake_tree') {
      moneyTree.shake = 1;
      for (let i = 0; i < 2; i++) {
        moneyTree.leaves.push({
          x: TREE_X + (Math.random() - 0.5) * TREE_RADIUS,
          y: TREE_Y - 8 + (Math.random() - 0.5) * 20,
          vx: (Math.random() - 0.5) * 36,
          vy: -8 - Math.random() * 16,
          spin: Math.random() * Math.PI,
          vs: (Math.random() - 0.5) * 6,
          life: 1,
        });
      }
    }
    window.TDG_PVP?.sendAction?.(action);
  }

  function serializeFarmer(f) {
    return {
      type: f.type || 'farmer',
      x: Math.round(f.x * 10) / 10,
      y: Math.round(f.y * 10) / 10,
      state: f.state,
      target: f.target,
      carry: (f.carry || []).map((c) => ({ v: c.v, e: c.e })),
      animT: Math.round((f.animT || 0) * 100) / 100,
      facing: Math.round((f.facing || 0) * 100) / 100,
      moving: f.moving ? 1 : 0,
    };
  }

  function serializeDog(d) {
    return {
      x: Math.round(d.x * 10) / 10,
      y: Math.round(d.y * 10) / 10,
      facing: Math.round((d.facing || 0) * 100) / 100,
      animT: Math.round((d.animT || 0) * 100) / 100,
    };
  }

  function serializeCustomer(c) {
    return {
      type: c.type,
      want: c.want,
      tip: c.tip,
      size: c.size,
      x: Math.round(c.x * 10) / 10,
      y: Math.round(c.y * 10) / 10,
      speed: c.speed,
      state: c.state,
      timer: Math.round((c.timer || 0) * 100) / 100,
      facing: Math.round((c.facing || 0) * 100) / 100,
      lane: Math.round((c.lane || 0) * 10) / 10,
      animT: Math.round((c.animT || 0) * 100) / 100,
    };
  }

  function serializePlayer(p) {
    return {
      name: p.name,
      slot: p.slot,
      gold: Math.floor(p.gold),
      earned: Math.floor(p.earned || 0),
      sold: p.sold || 0,
      unlocked: { ...p.unlocked },
      tree: JSON.parse(JSON.stringify(p.tree)),
      workerSkills: JSON.parse(JSON.stringify(p.workerSkills || freshWorkerSkills())),
      hired: { ...(p.hired || {}) },
      placed: { ...p.placed },
      farms: p.farms.map((f) => ({
        slot: f.slot,
        type: f.type,
        acc: Math.round((f.acc || 0) * 100) / 100,
        ready: f.ready || 0,
        progress: Math.round((f.progress || 0) * 1000) / 1000,
      })),
      farmers: p.farmers.map(serializeFarmer),
      dogs: p.dogs.map(serializeDog),
      stand: {
        level: p.stand.level,
        stock: (p.stand.stock || []).map((s) => ({ v: s.v, e: s.e })),
        customerAcc: Math.round((p.stand.customerAcc || 0) * 100) / 100,
      },
      customers: (p.customers || []).map(serializeCustomer),
      hint: p.hint || '',
      gone: !!p.gone,
      solo: !!p.solo,
    };
  }

  function serializeMatchState() {
    return {
      mode: 'farmers',
      gameId: match?.gameId || cfg?.roomId || null,
      ended: !!match?.ended,
      winnerSlot: match?.ended ? match.winnerSlot : null,
      elapsed: Math.round((match?.elapsed || clock) * 100) / 100,
      moneyTree: {
        shake: moneyTree.shake,
        sway: moneyTree.sway,
        clicks: moneyTree.clicks,
      },
      players: match.players.map(serializePlayer),
    };
  }

  function publishAuthState(force = false) {
    if (!active || !match || !isAuthority() || cfg.solo) return;
    const now = performance.now();
    if (!force && now - lastAuthPublishAt < AUTH_SYNC_MS) return;
    lastAuthPublishAt = now;
    const snap = serializeMatchState();
    window.TDG_PVP?.sendState?.(snap);
  }

  function hydratePlayer(raw, fallbackSlot) {
    const slot = raw?.slot ?? fallbackSlot;
    const base = freshPlayer(raw?.name || (slot === 0 ? 'Farmer' : 'Rival'), slot);
    if (!raw) return base;
    base.gold = Number(raw.gold) || START_GOLD;
    base.earned = Number(raw.earned) || 0;
    base.sold = Number(raw.sold) || 0;
    base.unlocked = raw.unlocked || { wheat: true };
    base.placed = raw.placed || {};
    base.hired = raw.hired || { farmer: 1 };
    base.workerSkills = freshWorkerSkills();
    if (raw.workerSkills) {
      for (const id of Object.keys(base.workerSkills)) {
        if (raw.workerSkills[id]) Object.assign(base.workerSkills[id], raw.workerSkills[id]);
      }
    }
    if (raw.tree) {
      for (const id of Object.keys(base.tree)) {
        if (raw.tree[id]) Object.assign(base.tree[id], raw.tree[id]);
      }
    }
    base.farms = (raw.farms || [])
      .filter((f) => FARM_BY_ID[f.type])
      .map((f) => ({
        slot: f.slot,
        type: f.type,
        acc: f.acc || 0,
        ready: f.ready || 0,
        progress: f.progress || 0,
      }));
    const lay = sideLayout(slot);
    base.farmers = (raw.farmers && raw.farmers.length)
      ? raw.farmers.map((f) => ({
          type: WORKER_BY_ID[f.type] ? f.type : 'farmer',
          x: f.x, y: f.y,
          state: f.state || 'idle',
          target: f.target ?? -1,
          carry: Array.isArray(f.carry) ? f.carry.map((c) => ({ v: c.v, e: c.e })) : [],
          animT: f.animT || 0,
          facing: f.facing || 0,
          moving: f.moving ? 1 : 0,
        }))
      : [freshWorker(lay.standX, lay.standY - 10, 'farmer')];
    base.dogs = (raw.dogs || []).map((d) => ({
      x: d.x, y: d.y, facing: d.facing || 0, animT: d.animT || 0,
    }));
    base.stand = {
      level: clamp(Number(raw.stand?.level) || 0, 0, STAND_UPGRADES.length),
      stock: Array.isArray(raw.stand?.stock) ? raw.stand.stock.map((s) => ({ v: s.v, e: s.e })) : [],
      customerAcc: Number(raw.stand?.customerAcc) || 2,
    };
    base.customers = (raw.customers || []).map((c) => ({
      type: c.type,
      want: c.want,
      tip: c.tip,
      size: c.size,
      x: c.x, y: c.y,
      speed: c.speed,
      state: c.state,
      timer: c.timer || 0,
      facing: c.facing || 0,
      lane: c.lane || 0,
      animT: c.animT || 0,
    }));
    base.hint = raw.hint || base.hint;
    base.gone = !!raw.gone;
    base.solo = !!raw.solo;
    return base;
  }

  // ─── Rendering ────────────────────────────────────────────────────────────
  function drawCloud(cx, cy, w, h, alpha) {
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    const puffs = [
      [0, 0, w * 0.28, h * 0.55],
      [w * 0.18, -h * 0.12, w * 0.34, h * 0.62],
      [w * 0.42, 0, w * 0.36, h * 0.58],
      [w * 0.62, -h * 0.08, w * 0.3, h * 0.5],
    ];
    for (const [px, py, pw, ph] of puffs) {
      ctx.beginPath();
      ctx.ellipse(cx + px, cy + py, pw, ph, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const CLOUDS = [
    { x: 0.08, y: 0.06, w: 120, h: 34 },
    { x: 0.3, y: 0.03, w: 90, h: 26 },
    { x: 0.55, y: 0.08, w: 140, h: 38 },
    { x: 0.78, y: 0.04, w: 100, h: 30 },
  ];

  function drawBackdrop() {
    const sky = ctx.createLinearGradient(0, 0, 0, LAND_TOP);
    sky.addColorStop(0, '#5a7a9a');
    sky.addColorStop(0.55, '#8ea8be');
    sky.addColorStop(1, '#b4c4b0');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, LAND_TOP);

    const drift = Math.sin(clock * 0.06) * 20;
    for (let i = 0; i < CLOUDS.length; i++) {
      const c = CLOUDS[i];
      const cx = ((c.x * W) + drift * (0.4 + (i % 3) * 0.2) + W) % (W + c.w) - c.w * 0.3;
      drawCloud(cx, LAND_TOP * (0.2 + c.y * 2.4), c.w, c.h, 0.72 - (i % 3) * 0.08);
    }

    // Distant hills
    ctx.fillStyle = 'rgba(55, 72, 48, 0.55)';
    ctx.beginPath();
    ctx.moveTo(0, LAND_TOP + 8);
    for (let x = 0; x <= W; x += 40) {
      ctx.lineTo(x, LAND_TOP - Math.sin(x * 0.008) * 22 - Math.cos(x * 0.015) * 14);
    }
    ctx.lineTo(W, LAND_TOP + 40);
    ctx.lineTo(0, LAND_TOP + 40);
    ctx.fill();

    const landH = LAND_BOTTOM - LAND_TOP;
    const field = ctx.createLinearGradient(0, LAND_TOP, 0, LAND_BOTTOM);
    field.addColorStop(0, '#7a9a5c');
    field.addColorStop(0.35, '#5d7a42');
    field.addColorStop(0.7, '#4a6335');
    field.addColorStop(1, '#3d5230');
    ctx.fillStyle = field;
    ctx.fillRect(0, LAND_TOP, W, landH);
    if (LAND_BOTTOM < H) {
      ctx.fillStyle = '#3d5230';
      ctx.fillRect(0, LAND_BOTTOM, W, H - LAND_BOTTOM);
    }

    // Owned turf reads a little different on each side of the road.
    const tintLeft = ctx.createLinearGradient(0, 0, ROAD_X - ROAD_HALF, 0);
    tintLeft.addColorStop(0, 'rgba(96, 150, 70, 0.5)');
    tintLeft.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = tintLeft;
    ctx.fillRect(0, LAND_TOP, ROAD_X - ROAD_HALF, landH);
    const tintRight = ctx.createLinearGradient(W, 0, ROAD_X + ROAD_HALF, 0);
    tintRight.addColorStop(0, 'rgba(120, 152, 74, 0.42)');
    tintRight.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = tintRight;
    ctx.fillRect(ROAD_X + ROAD_HALF, LAND_TOP, W - ROAD_X - ROAD_HALF, landH);

    // Grass tufts
    for (let i = 0; i < 140; i++) {
      const gx = (i * 97 + 31) % W;
      const gy = LAND_TOP + 20 + (i * 53) % (landH - 40);
      ctx.fillStyle = i % 3 === 0 ? 'rgba(45,60,32,0.18)' : 'rgba(110,140,75,0.14)';
      ctx.beginPath();
      ctx.ellipse(gx, gy, 18 + (i % 5) * 6, 8 + (i % 4) * 3, i * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Market road down the middle
    const road = ctx.createLinearGradient(ROAD_X - ROAD_HALF, 0, ROAD_X + ROAD_HALF, 0);
    road.addColorStop(0, 'rgba(0,0,0,0)');
    road.addColorStop(0.3, 'rgba(120, 96, 62, 0.6)');
    road.addColorStop(0.5, 'rgba(138, 112, 74, 0.72)');
    road.addColorStop(0.7, 'rgba(120, 96, 62, 0.6)');
    road.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = road;
    ctx.fillRect(ROAD_X - ROAD_HALF - 30, LAND_TOP, ROAD_HALF * 2 + 60, landH);
    for (let i = 0; i < 26; i++) {
      const sx = ROAD_X + Math.sin(i * 3.1) * ROAD_HALF * 0.7;
      const sy = LAND_TOP + 14 + i * (landH / 26);
      ctx.fillStyle = 'rgba(90, 70, 44, 0.4)';
      ctx.beginPath();
      ctx.ellipse(sx, sy, 9 + (i % 3) * 4, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Worn cart lanes from each farm block down to the stand.
    for (let slot = 0; slot < 2; slot++) {
      const lay = sideLayout(slot);
      const laneX = lay.farmX0 + lay.dir * ((FARM_COLS - 1) * 108 + 58);
      ctx.strokeStyle = 'rgba(116, 92, 58, 0.34)';
      ctx.lineWidth = 16;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(laneX, LAND_TOP + 100);
      ctx.lineTo(laneX, lay.standY - 4);
      ctx.lineTo(lay.standX - lay.dir * 6, lay.standY + 4);
      ctx.stroke();
      ctx.lineWidth = 1;
    }

    // Soft valley haze, same trick the Local Game uses to settle the field down.
    const haze = ctx.createLinearGradient(0, LAND_TOP + 30, 0, LAND_BOTTOM);
    haze.addColorStop(0, 'rgba(214, 224, 226, 0)');
    haze.addColorStop(0.3, 'rgba(198, 210, 216, 0.09)');
    haze.addColorStop(1, 'rgba(168, 182, 190, 0.2)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, LAND_TOP + 30, W, LAND_BOTTOM - LAND_TOP - 30);

    // Tree lines along the outer edges
    for (let side = 0; side < 2; side++) {
      const baseX = side === 0 ? 24 : W - 24;
      for (let i = 0; i < 7; i++) {
        const tx = baseX + (side === 0 ? 1 : -1) * (i % 3) * 16;
        const ty = LAND_TOP + 42 + i * ((landH - 84) / 6);
        ctx.fillStyle = 'rgba(30, 45, 25, 0.75)';
        ctx.beginPath();
        ctx.moveTo(tx, ty - 32);
        ctx.lineTo(tx - 13, ty + 6);
        ctx.lineTo(tx + 13, ty + 6);
        ctx.fill();
        ctx.fillStyle = 'rgba(45, 35, 25, 0.85)';
        ctx.fillRect(tx - 3, ty + 4, 6, 12);
      }
    }
  }

  function drawPlacementHints() {
    if (!me) return;
    ctx.save();
    ctx.setLineDash([5, 6]);
    ctx.lineWidth = 1.5;
    if (sellMode) {
      ctx.strokeStyle = 'rgba(255, 140, 100, 0.7)';
      for (const farm of me.farms) {
        const pos = slotPosition(me.slot, farm.slot);
        ctx.strokeRect(pos.x - FARM_SIZE, pos.y - FARM_SIZE * 0.72, FARM_SIZE * 2, FARM_SIZE * 1.44);
      }
      ctx.restore();
      return;
    }
    const used = new Set(me.farms.map((f) => f.slot));
    if (used.size >= FARM_SLOTS) { ctx.restore(); return; }
    const def = FARM_BY_ID[selectedSeed];
    const affordable = def && me.unlocked[def.id] && me.gold >= nextFarmCost(me, def.id);
    ctx.strokeStyle = affordable ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.16)';
    for (let i = 0; i < FARM_SLOTS; i++) {
      if (used.has(i)) continue;
      const pos = slotPosition(me.slot, i);
      ctx.strokeRect(pos.x - FARM_SIZE, pos.y - FARM_SIZE * 0.72, FARM_SIZE * 2, FARM_SIZE * 1.44);
    }
    ctx.restore();
  }

  function drawFarmsFor(state, isMine) {
    const drawPlot = window.__TDG?.drawFarmPlotOnContext;
    for (const farm of state.farms) {
      const pos = slotPosition(state.slot, farm.slot);
      const def = FARM_BY_ID[farm.type] || FARM_TYPES[0];
      const density = densityFor(state, farm.type);
      if (drawPlot) {
        ctx.save();
        drawPlot(ctx, pos.x, pos.y, FARM_SIZE, {
          seed: (farm.slot * 37 % 100) / 100,
          growth: farm.progress || 0,
          density,
          cropEmojis: def.crops,
          emojiScale: 2.6,
        });
        ctx.restore();
        ctx.globalAlpha = 1;
      }
      if (farm.ready > 0) {
        const bx = pos.x + FARM_SIZE * 0.72;
        const by = pos.y - FARM_SIZE * 0.62;
        ctx.fillStyle = 'rgba(18, 24, 16, 0.66)';
        ctx.beginPath();
        ctx.arc(bx, by, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffe9a8';
        ctx.font = 'bold 10px Rajdhani, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${Math.floor(farm.ready)}`, bx, by + 0.5);
        ctx.textBaseline = 'alphabetic';
      }
    }
  }

  function drawStand(state, isMine) {
    const lay = sideLayout(state.slot);
    const x = lay.standX;
    const y = lay.standY;
    const level = state.stand?.level || 0;
    const stock = state.stand?.stock?.length || 0;
    const w = 92 + level * 7;

    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(x, y + 26, w * 0.6, 11, 0, 0, Math.PI * 2);
    ctx.fill();

    // Counter
    ctx.fillStyle = '#8b5a2b';
    roundRect(x - w / 2, y - 6, w, 30, 4);
    ctx.fill();
    ctx.fillStyle = '#6f4520';
    ctx.fillRect(x - w / 2, y + 14, w, 6);

    // Awning with a stripe per upgrade level
    const stripes = 4 + level;
    for (let i = 0; i < stripes; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#d94f4f' : '#f5efe0';
      ctx.beginPath();
      ctx.moveTo(x - w / 2 + (i * w) / stripes, y - 8);
      ctx.lineTo(x - w / 2 + ((i + 1) * w) / stripes, y - 8);
      ctx.lineTo(x - w / 2 + ((i + 1) * w) / stripes, y - 24);
      ctx.lineTo(x - w / 2 + (i * w) / stripes, y - 24);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#5c3a18';
    ctx.fillRect(x - w / 2 - 3, y - 26, w + 6, 4);
    ctx.fillRect(x - w / 2, y - 22, 4, 30);
    ctx.fillRect(x + w / 2 - 4, y - 22, 4, 30);

    // Produce on the shelf
    const shown = Math.min(8, stock);
    for (let i = 0; i < shown; i++) {
      ctx.fillStyle = i % 2 ? '#e8c374' : '#f2dc9c';
      ctx.beginPath();
      ctx.arc(x - w / 2 + 12 + i * ((w - 24) / 7), y + 4, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = isMine ? '#bff5c0' : '#ffd2ad';
    ctx.font = 'bold 12px Rajdhani, sans-serif';
    ctx.textAlign = 'center';
    const label = state.solo ? state.name : `${state.name} · ${money(state.gold)}`;
    ctx.fillText(label, x, y + 40);
    if (!state.solo) {
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = '10px Rajdhani, sans-serif';
      ctx.fillText(`Stand Lv ${level + 1} · ${stock} ready`, x, y + 53);
    }
    ctx.restore();
  }

  /** The shared money tree standing in the middle of the valley road. */
  function drawMoneyTree() {
    const shake = moneyTree.shake;
    const sway = Math.sin(moneyTree.sway * 1.1) * 0.02;
    const wobble = shake > 0 ? Math.sin(shake * 34) * shake * 0.09 : 0;

    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(TREE_X, TREE_Y + 46, 42, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // Little mound of turf so the tree isn't floating on bare road.
    ctx.fillStyle = 'rgba(92, 124, 62, 0.85)';
    ctx.beginPath();
    ctx.ellipse(TREE_X, TREE_Y + 44, 46, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.translate(TREE_X, TREE_Y + 44);
    ctx.rotate(sway + wobble);
    ctx.translate(-TREE_X, -(TREE_Y + 44));

    // Trunk and two boughs
    ctx.strokeStyle = '#5c3f22';
    ctx.lineCap = 'round';
    ctx.lineWidth = 13;
    ctx.beginPath();
    ctx.moveTo(TREE_X, TREE_Y + 44);
    ctx.lineTo(TREE_X, TREE_Y - 4);
    ctx.stroke();
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(TREE_X, TREE_Y + 12);
    ctx.lineTo(TREE_X - 20, TREE_Y - 12);
    ctx.moveTo(TREE_X, TREE_Y + 6);
    ctx.lineTo(TREE_X + 20, TREE_Y - 16);
    ctx.stroke();
    ctx.lineWidth = 1;

    const canopy = [
      [0, -30, 34, 27, '#3f6b2e'],
      [-24, -16, 26, 21, '#477a33'],
      [24, -20, 25, 20, '#477a33'],
      [-8, -44, 24, 19, '#568c3c'],
      [14, -40, 22, 18, '#568c3c'],
    ];
    for (const [ox, oy, rx, ry, color] of canopy) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(TREE_X + ox, TREE_Y + oy, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Coins hanging in the branches
    ctx.font = '13px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const coins = [
      [-26, -8],
      [22, -6],
      [-4, -50],
      [12, -26],
      [-18, -34],
    ];
    for (let i = 0; i < coins.length; i++) {
      const bob = Math.sin(moneyTree.sway * 2 + i) * 2;
      ctx.fillText('🪙', TREE_X + coins[i][0], TREE_Y + coins[i][1] + bob);
    }
    ctx.restore();

    for (const leaf of moneyTree.leaves) {
      ctx.save();
      ctx.globalAlpha = clamp(leaf.life, 0, 1);
      ctx.translate(leaf.x, leaf.y);
      ctx.rotate(leaf.spin);
      ctx.font = '12px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🍃', 0, 0);
      ctx.restore();
    }

    ctx.save();
    ctx.globalAlpha = 0.5 + Math.sin(moneyTree.sway * 2.2) * 0.14;
    ctx.fillStyle = '#ffe9a8';
    ctx.font = 'bold 11px Rajdhani, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`CLICK THE TREE  +${money(TREE_CLICK_REWARD)}`, TREE_X, TREE_Y + 68);
    ctx.restore();
    ctx.textBaseline = 'alphabetic';
    ctx.globalAlpha = 1;
  }

  function drawFloaters() {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = 'bold 13px Rajdhani, sans-serif';
    for (const f of floaters) {
      ctx.globalAlpha = clamp(f.life, 0, 1);
      ctx.fillStyle = 'rgba(12, 18, 10, 0.55)';
      ctx.fillText(f.text, f.x + 1, f.y + 1);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawShop(state) {
    const lay = sideLayout(state.slot);
    const x = lay.shopX;
    const y = lay.shopY;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(x, y + 20, 30, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7a5230';
    roundRect(x - 26, y - 12, 52, 32, 4);
    ctx.fill();
    ctx.fillStyle = '#4e3a22';
    ctx.beginPath();
    ctx.moveTo(x - 32, y - 12);
    ctx.lineTo(x, y - 32);
    ctx.lineTo(x + 32, y - 12);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f3e3b8';
    ctx.font = '14px Rajdhani, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🌱', x, y + 10);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = '10px Rajdhani, sans-serif';
    ctx.fillText('Seed Shop', x, y + 32);
    ctx.restore();
  }

  /**
   * The shared sprite renderer can leave alpha/transform state behind on our
   * context, so every actor draw is fenced off with save/restore.
   */
  function drawActor(type, ent, size, extra = {}) {
    const drawFn = window.__TDG?.drawUnitOnContext;
    let drew = false;
    if (drawFn) {
      ctx.save();
      try {
        drew = drawFn(ctx, type, ent.x, ent.y, ent.facing || 0, size, {
          animT: ent.animT || 0,
          moveSpeed: extra.moveSpeed || 0,
          attackPhase: 'idle',
          attackProgress: 0,
          ownerId: extra.ownerId ?? 0,
        }) !== false;
      } catch (err) {
        drew = false;
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    }
    if (drew) return;
    ctx.fillStyle = extra.color || '#c4a574';
    ctx.beginPath();
    ctx.arc(ent.x, ent.y, size * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPeople(state, isMine) {
    const ownerId = state.slot;
    for (const farmer of state.farmers) {
      const wdef = WORKER_BY_ID[farmer.type] || WORKER_TYPES[0];
      drawActor(wdef.sprite, farmer, wdef.size, { moveSpeed: farmer.moving ? 40 : 0, ownerId });
      if (farmer.carry?.length) {
        const def = FARM_BY_ID[farmer.carry[farmer.carry.length - 1].e] || FARM_TYPES[0];
        const bx = farmer.x;
        const by = farmer.y - 26;
        ctx.fillStyle = 'rgba(16, 22, 14, 0.7)';
        roundRect(bx - 15, by - 9, 30, 17, 6);
        ctx.fill();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '11px serif';
        ctx.fillText(def.emoji, bx - 6, by);
        ctx.fillStyle = '#ffe9a8';
        ctx.font = 'bold 11px Rajdhani, sans-serif';
        ctx.fillText(`${farmer.carry.length}`, bx + 7, by + 0.5);
        ctx.textBaseline = 'alphabetic';
      }
    }
    for (const dog of (state.dogs || [])) drawActor('speed', dog, 20, { moveSpeed: 30, ownerId });
    for (const c of (state.customers || [])) {
      drawActor(c.type, c, c.size * 0.78, { moveSpeed: c.state === 'buying' ? 0 : 30, ownerId });
      if (c.state === 'buying') {
        ctx.textAlign = 'center';
        ctx.font = '13px serif';
        ctx.fillText('💰', c.x, c.y - c.size * 0.78 - 8);
      }
    }
  }

  function renderScene() {
    if (!ctx || !me) return;
    ctx.clearRect(0, 0, W, H);
    drawBackdrop();
    drawPlacementHints();

    if (peer) {
      drawFarmsFor(peer, false);
      drawShop(peer);
      drawStand(peer, false);
      drawPeople(peer, false);
    }
    drawFarmsFor(me, true);
    drawShop(me);
    drawStand(me, true);
    drawPeople(me, true);
    drawMoneyTree();
    drawFloaters();
  }

  // ─── HUD / panels ─────────────────────────────────────────────────────────
  /** Cheap per-frame text refresh — never touches innerHTML. */
  function renderReadouts() {
    if (!me) return;
    const set = (id, text) => {
      const el = $(id);
      if (el && el.textContent !== text) el.textContent = text;
    };

    set('farmers-you-name', me.name);
    set('farmers-you-gold', money(me.gold));
    set('farmers-you-sold', `${me.sold}`);
    set('farmers-them-name', peer ? peer.name : 'Rival');
    set('farmers-them-gold', peer && !peer.solo && !peer.gone ? money(peer.gold) : '—');
    const gid = match?.gameId || cfg?.roomId || window.TDG_PVP?.getGameId?.() || '';
    set('farmers-game-id', shortGameId(gid));
    const gidEl = $('farmers-game-id');
    if (gidEl) gidEl.title = gid ? `Game ID: ${gid}` : 'No game id';
    set('farmers-stock', `${me.stand.stock.length}/${standCapacity(me)}`);
    set('farmers-workers', `${me.farmers.length}/${MAX_WORKERS}`);
    set('farmers-dogs', `${me.dogs.length}/${MAX_DOGS}`);
    set('farmers-farmcount', `${me.farms.length}/${FARM_SLOTS}`);
  }

  function openSheet(name) {
    activeSheet = name || null;
    sellMode = false;
    const sheet = $('farmers-sheet');
    const title = $('farmers-sheet-title');
    const titles = {
      seeds: '🌱 Seed Shop',
      helpers: '🧑‍🌾 Helpers',
      skills: '🌿 Farm Skills',
      stand: '🏪 Stand & Buyout',
    };
    if (!sheet) return;
    if (!activeSheet) {
      sheet.classList.remove('open');
      sheet.setAttribute('aria-hidden', 'true');
    } else {
      sheet.classList.add('open');
      sheet.setAttribute('aria-hidden', 'false');
      if (title) title.textContent = titles[activeSheet] || 'Menu';
    }
    for (const pane of document.querySelectorAll('.farmers-sheet-pane')) {
      const showPane = pane.getAttribute('data-pane') === activeSheet;
      pane.classList.toggle('hidden', !showPane);
    }
    for (const tab of document.querySelectorAll('.farmers-dock-tab[data-sheet]')) {
      tab.classList.toggle('active', tab.getAttribute('data-sheet') === activeSheet);
    }
    const sellBtn = $('farmers-btn-sell');
    sellBtn?.classList.toggle('active', false);
    hudDirty = true;
  }

  function closeSheet() {
    openSheet(null);
  }

  function branchRowsHtml(branches, rec, maxTier, costFn, dataPrefix, dataId) {
    return branches.map((branch) => {
      const tier = rec[branch.id] || 0;
      const maxed = tier >= maxTier;
      const cost = maxed ? 0 : costFn(branch.id, tier);
      const pips = Array.from({ length: maxTier }, (_, i) =>
        `<i class="farmers-pip${i < tier ? ' on' : ''}"></i>`).join('');
      const btn = maxed
        ? '<span class="farmers-branch-max">MAX</span>'
        : `<button type="button" class="farmers-branch-buy" data-${dataPrefix}-branch="${branch.id}" data-${dataPrefix}-id="${dataId}"${me.gold >= cost ? '' : ' disabled'}>${money(cost)}</button>`;
      return `<div class="farmers-branch">
        <span class="farmers-branch-icon">${branch.icon}</span>
        <span class="farmers-branch-body">
          <span class="farmers-branch-name">${branch.name}</span>
          <span class="farmers-branch-blurb">${branch.blurb}</span>
          <span class="farmers-pips">${pips}</span>
        </span>
        ${btn}
      </div>`;
    }).join('');
  }

  /** Rebuilds the shop / tree markup. Only call when something actually changed. */
  function renderPanels() {
    if (!me) return;
    const seedRow = $('farmers-seed-row');
    if (seedRow) {
      seedRow.innerHTML = FARM_TYPES.map((def) => {
        const owned = !!me.unlocked[def.id];
        const chosen = selectedSeed === def.id;
        const cost = owned ? nextFarmCost(me, def.id) : def.unlock;
        const label = owned ? `Plant ${money(cost)}` : `Unlock ${money(cost)}`;
        const cls = ['farmers-seed', owned ? 'owned' : 'locked', chosen ? 'chosen' : '']
          .filter(Boolean)
          .join(' ');
        const afford = me.gold >= cost ? '' : ' disabled';
        return `<button type="button" class="${cls}" data-seed="${def.id}"${owned ? '' : afford}>
          <span class="farmers-seed-emoji">${def.emoji}</span>
          <span class="farmers-seed-body">
            <span class="farmers-seed-name">${def.name}</span>
            <span class="farmers-seed-meta">sells ${money(def.price)} · ${def.grow.toFixed(1)}s</span>
          </span>
          <span class="farmers-seed-cost">${label}</span>
        </button>`;
      }).join('');
    }

    const helperRow = $('farmers-helper-row');
    if (helperRow) {
      helperRow.innerHTML = WORKER_TYPES.map((def) => {
        const cost = workerHireCost(me, def.id);
        const owned = me.hired?.[def.id] || 0;
        const full = me.farmers.length >= MAX_WORKERS;
        const cls = ['farmers-helper', owned ? 'owned' : '', selectedHelper === def.id ? 'chosen' : '']
          .filter(Boolean).join(' ');
        const disabled = full || me.gold < cost || match?.ended ? ' disabled' : '';
        const skills = me.workerSkills?.[def.id] || { speed: 0, carry: 0 };
        const carry = def.carry + (skills.carry || 0) * WORKER_CARRY_PER_TIER;
        const spd = Math.round(def.speed * (1 + (skills.speed || 0) * WORKER_SPEED_PER_TIER));
        return `<button type="button" class="${cls}" data-hire="${def.id}"${disabled}>
          <span class="farmers-helper-emoji">${def.emoji}</span>
          <span class="farmers-helper-body">
            <span class="farmers-helper-name">${def.name}${owned ? ` ×${owned}` : ''}</span>
            <span class="farmers-helper-meta">carry ${carry} · spd ${spd}</span>
          </span>
          <span class="farmers-helper-cost">Hire ${money(cost)}</span>
        </button>`;
      }).join('');
    }

    const helperTabs = $('farmers-helper-tabs');
    if (helperTabs) {
      helperTabs.innerHTML = WORKER_TYPES
        .filter((d) => (me.hired?.[d.id] || 0) > 0)
        .map((d) => `<button type="button" class="farmers-tab${helperTreeType === d.id ? ' chosen' : ''}" data-helper-tree="${d.id}">${d.emoji}</button>`)
        .join('') || '<span class="farmers-tree-head">Hire a helper to unlock its skill tree.</span>';
    }
    const helperTree = $('farmers-helper-tree');
    if (helperTree) {
      if (!(me.hired?.[helperTreeType] > 0)) {
        const first = WORKER_TYPES.find((d) => (me.hired?.[d.id] || 0) > 0);
        helperTreeType = first ? first.id : 'farmer';
      }
      if (!me.workerSkills) me.workerSkills = freshWorkerSkills();
      const def = WORKER_BY_ID[helperTreeType] || WORKER_TYPES[0];
      const rec = me.workerSkills[helperTreeType] || { speed: 0, carry: 0 };
      const branches = [
        { id: 'speed', name: 'Speed', icon: '💨', blurb: 'Moves to plots and the stand faster' },
        { id: 'carry', name: 'Carry', icon: '📦', blurb: 'Hauls more produce per trip' },
      ];
      const cap = workerCapacity(me, { type: helperTreeType });
      const spd = Math.round(workerSpeed(me, { type: helperTreeType }));
      helperTree.innerHTML = `<div class="farmers-tree-head">${def.emoji} ${def.name} — speed ${spd}, carry ${cap}</div>`
        + branchRowsHtml(branches, rec, WORKER_SKILL_MAX, (branch, tier) => workerSkillCost(helperTreeType, branch, tier), 'worker', helperTreeType);
    }

    const treeTabs = $('farmers-tree-tabs');
    if (treeTabs) {
      treeTabs.innerHTML = FARM_TYPES.filter((d) => me.unlocked[d.id])
        .map((d) => `<button type="button" class="farmers-tab${treeType === d.id ? ' chosen' : ''}" data-tree="${d.id}">${d.emoji}</button>`)
        .join('');
    }

    const treeBody = $('farmers-tree-body');
    if (treeBody) {
      if (!me.unlocked[treeType]) treeType = 'wheat';
      const def = FARM_BY_ID[treeType];
      const rec = me.tree[treeType];
      const per = yieldPer(me, treeType);
      treeBody.innerHTML = `<div class="farmers-tree-head">${def.emoji} ${def.name} — ${per} crop${per === 1 ? '' : 's'} every ${growInterval(me, treeType).toFixed(1)}s, ${money(unitPrice(me, treeType))} each</div>`
        + branchRowsHtml(FARM_BRANCHES, rec, BRANCH_MAX, (branch, tier) => branchCost(treeType, branch, tier), 'farm', treeType);
    }

    const dCost = me.dogs.length >= MAX_DOGS ? null : dogCost(me);
    const sCost = me.stand.level >= STAND_UPGRADES.length ? null : STAND_UPGRADES[me.stand.level];
    setBtn('farmers-btn-dog', dCost == null ? 'Dog pack full' : `Buy Farm Dog ${money(dCost)}`, dCost != null && me.gold >= dCost && !match?.ended);
    setBtn('farmers-btn-stand', sCost == null ? 'Stand maxed' : `Upgrade Stand ${money(sCost)}`, sCost != null && me.gold >= sCost && !match?.ended);

    const sellBtn = $('farmers-btn-sell');
    if (sellBtn) {
      sellBtn.textContent = sellMode ? 'Cancel sell' : 'Sell a plot';
      sellBtn.classList.toggle('active', sellMode);
      sellBtn.disabled = !!(match?.ended) || (!sellMode && me.farms.length === 0);
    }
    const buyBtn = $('farmers-btn-buyout');
    if (buyBtn) {
      const rival = peer && !peer.solo && !peer.gone;
      const ended = !!match?.ended;
      buyBtn.textContent = ended
        ? (match.winnerSlot === me.slot ? 'Valley claimed' : 'Farm sold')
        : `Buy their farm ${money(BUYOUT_COST)}`;
      buyBtn.disabled = ended || !rival || me.gold < BUYOUT_COST;
    }
    hudDirty = false;
  }

  function setBtn(id, label, enabled) {
    const el = $(id);
    if (!el) return;
    if (el.textContent !== label) el.textContent = label;
    el.disabled = !enabled;
  }

  // ─── Input ────────────────────────────────────────────────────────────────
  function canvasToLogic(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * W,
      y: ((clientY - rect.top) / rect.height) * H,
    };
  }

  function onCanvasClick(e) {
    if (!me || match?.ended) return;
    const pt = canvasToLogic(e.clientX, e.clientY);

    if (Math.hypot(pt.x - TREE_X, pt.y - (TREE_Y + 4)) <= TREE_RADIUS) {
      dispatchLocal({ type: 'farmers_shake_tree' });
      return;
    }

    if (sellMode) {
      const hit = occupiedFarmNear(me, pt.x, pt.y);
      if (!hit) {
        setHint('Click one of your highlighted plots to sell it.');
        return;
      }
      dispatchLocal({ type: 'farmers_sell_farm', slot: hit.farm.slot });
      return;
    }

    const spot = freeSlotNear(me, pt.x, pt.y);
    if (spot.slot < 0) {
      setHint('Your land is full of farms.');
      return;
    }
    if (spot.dist > 150) {
      setHint('Click your own side of the road to plant.');
      return;
    }
    dispatchLocal({ type: 'farmers_place_farm', x: pt.x, y: pt.y, seed: selectedSeed });
  }

  function bindUi() {
    $('farmers-seed-row')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-seed]');
      if (!btn) return;
      const id = btn.getAttribute('data-seed');
      if (me?.unlocked[id]) {
        selectedSeed = id;
        treeType = id;
        sellMode = false;
        setHint(`${FARM_BY_ID[id].name} selected — click your land to plant.`);
        hudDirty = true;
      } else {
        dispatchLocal({ type: 'farmers_unlock_seed', seed: id });
      }
    });
    $('farmers-helper-row')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-hire]');
      if (!btn) return;
      const id = btn.getAttribute('data-hire');
      selectedHelper = id;
      helperTreeType = id;
      dispatchLocal({ type: 'farmers_hire', worker: id });
    });
    $('farmers-helper-tabs')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-helper-tree]');
      if (!btn) return;
      helperTreeType = btn.getAttribute('data-helper-tree');
      selectedHelper = helperTreeType;
      hudDirty = true;
    });
    $('farmers-helper-tree')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-worker-branch]');
      if (!btn) return;
      dispatchLocal({
        type: 'farmers_worker_branch',
        worker: btn.getAttribute('data-worker-id'),
        branch: btn.getAttribute('data-worker-branch'),
      });
    });
    $('farmers-tree-tabs')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-tree]');
      if (!btn) return;
      treeType = btn.getAttribute('data-tree');
      hudDirty = true;
    });
    $('farmers-tree-body')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-farm-branch]');
      if (!btn) return;
      dispatchLocal({
        type: 'farmers_buy_branch',
        seed: btn.getAttribute('data-farm-id') || treeType,
        branch: btn.getAttribute('data-farm-branch'),
      });
    });
    document.querySelector('.farmers-dock-tabs')?.addEventListener('click', (e) => {
      const tab = e.target.closest('.farmers-dock-tab');
      if (!tab) return;
      if (tab.id === 'farmers-btn-sell') {
        if (match?.ended) return;
        closeSheet();
        sellMode = !sellMode;
        tab.classList.toggle('active', sellMode);
        setHint(sellMode
          ? 'Sell mode — click a planted plot to sell it back for 60% of what you paid.'
          : 'Plant mode — select a seed and click empty land.');
        hudDirty = true;
        return;
      }
      const sheet = tab.getAttribute('data-sheet');
      if (!sheet) return;
      openSheet(activeSheet === sheet ? null : sheet);
    });
    $('farmers-sheet-close')?.addEventListener('click', closeSheet);
    $('farmers-btn-dog')?.addEventListener('click', () => dispatchLocal({ type: 'farmers_buy_dog' }));
    $('farmers-btn-stand')?.addEventListener('click', () => dispatchLocal({ type: 'farmers_upgrade_stand' }));
    $('farmers-btn-buyout')?.addEventListener('click', () => {
      if (match?.ended) return;
      dispatchLocal({ type: 'farmers_buyout' });
    });
    $('farmers-howto-btn')?.addEventListener('click', () => show($('farmers-howto')));
    $('farmers-howto-close')?.addEventListener('click', () => hide($('farmers-howto')));
    $('farmers-end-home')?.addEventListener('click', () => {
      cleanup(true);
      window.TDG_PVP?.goHome?.();
    });
    $('farmers-leave-btn')?.addEventListener('click', () => {
      cleanup(true);
      window.TDG_PVP?.goHome?.();
    });
  }

  // ─── Loop ─────────────────────────────────────────────────────────────────
  function loop(ts) {
    if (!active) return;
    raf = requestAnimationFrame(loop);
    if (!lastTs) lastTs = ts;
    const frame = clamp((ts - lastTs) / 1000, 0, 0.05);
    lastTs = ts;
    const dt = frame;
    clock += dt;
    if (match) match.elapsed = (match.elapsed || 0) + dt;

    if (isAuthority() && match && !match.ended) {
      for (const p of match.players) {
        if (!p || p.gone || p.solo) continue;
        tickFarms(p, dt);
        tickFarmers(p, dt);
        tickCustomers(p, dt);
      }
      tickExtras(dt);
      publishAuthState(false);
      if (clock - lastPersistAt > PERSIST_MS / 1000) {
        lastPersistAt = clock;
        window.TDG_PVP?.persistLiveState?.(serializeMatchState(), {
          mode: 'farmers',
          roomId: match.gameId || cfg.roomId,
        });
      }
    } else {
      // Guest: only animate local FX; the host owns the sim.
      tickExtras(dt);
    }

    renderScene();
    renderReadouts();
    if (hudDirty || clock - lastPanelAt > 1) {
      lastPanelAt = clock;
      renderPanels();
    }
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────
  function start(opts) {
    cleanup(false);
    const mySlot = opts.myPlayerId === 1 ? 1 : 0;
    const theirSlot = mySlot === 0 ? 1 : 0;
    const myName = mySlot === 0 ? opts.player0Name : opts.player1Name;
    const theirName = mySlot === 0 ? opts.player1Name : opts.player0Name;

    const gameId = opts.roomId || opts.gameId || (opts.solo ? mintSoloGameId() : null);
    cfg = {
      myPlayerId: mySlot,
      roomId: gameId,
      gameId,
      isHost: !!opts.isHost,
      solo: !!opts.solo,
    };
    // Same URL contract as Online PvP / TFT: one ?game= id for the whole match.
    if (gameId) window.TDG_PVP?.setGameUrl?.(gameId, 'farmers');

    const p0 = freshPlayer(
      mySlot === 0 ? (myName || 'You') : (theirName || 'Rival'),
      0,
    );
    const p1 = freshPlayer(
      mySlot === 1 ? (myName || 'You') : (theirName || 'Rival'),
      1,
    );
    if (opts.solo) {
      const empty = mySlot === 0 ? p1 : p0;
      empty.solo = true;
      empty.name = theirName || 'Empty stall';
      empty.farms = [0, 5, 9].map((slot) => ({
        slot,
        type: 'wheat',
        acc: Math.random() * 4,
        ready: 0,
        progress: 0,
      }));
      empty.farmers = [];
      empty.dogs = [];
      empty.customers = [];
      empty.stand.stock = [];
    }

    match = {
      gameId,
      players: [p0, p1],
      elapsed: 0,
      ended: false,
      winnerSlot: null,
    };
    rebindPlayers();

    if (opts.savedState && opts.savedState.mode === 'farmers') {
      applyAuthState(opts.savedState, true);
      rebindPlayers();
      gotAuthSnapshot = true;
      if (match?.ended) showEndScreen();
    }

    active = true;
    lastTs = 0;
    clock = match.elapsed || 0;
    lastAuthPublishAt = 0;
    lastPersistAt = 0;
    hudDirty = true;
    sellMode = false;
    activeSheet = null;
    selectedHelper = 'farmer';
    helperTreeType = 'farmer';
    gotAuthSnapshot = isAuthority();
    moneyTree = { shake: 0, sway: 0, clicks: opts.savedState?.moneyTree?.clicks || 0, leaves: [] };
    floaters = [];

    hide($('menu-screen'));
    hide($('online-match-screen'));
    hide($('online-queue-screen'));
    hide($('tft-game-screen'));
    hide($('farmers-howto'));
    hide($('farmers-end'));
    show($('farmers-game-screen'));
    closeSheet();

    canvas = $('farmers-canvas');
    if (canvas) {
      canvas.width = W;
      canvas.height = H;
      ctx = canvas.getContext('2d');
      canvas.onclick = onCanvasClick;
    }
    if (!uiBound) {
      bindUi();
      uiBound = true;
    }
    setHint(me?.hint || 'Plant Wheat on your land, then click the money tree in the middle for pocket change.');
    renderReadouts();
    renderPanels();
    renderScene();
    raf = requestAnimationFrame(loop);

    if (isAuthority()) {
      publishAuthState(true);
      [300, 900, 1800].forEach((ms) => {
        setTimeout(() => { if (active && isAuthority()) publishAuthState(true); }, ms);
      });
    } else {
      dispatchLocal({ type: 'farmers_request_sync' });
    }
  }

  function cleanup(hard) {
    active = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (hard) {
      me = null;
      peer = null;
      match = null;
      cfg = null;
      hide($('farmers-game-screen'));
    }
  }

  function handleRemote(from, action) {
    if (!active || !action) return false;
    const nested = action.action && action.action.type ? action.action : action;
    if (!String(nested.type || '').startsWith('farmers_')) return false;
    if (from === cfg?.myPlayerId) return true;
    if (!isAuthority()) return true;
    applyAction(from, nested);
    return true;
  }

  /** Peaceful mode: a departing rival just leaves an empty stall behind. */
  function applyForfeit(fromSlot) {
    if (!match?.players?.[fromSlot]) return;
    if (fromSlot === cfg?.myPlayerId) return;
    const rival = match.players[fromSlot];
    rival.gone = true;
    setHint(`${rival.name} packed up and left. Your farm keeps going.`);
    if (isAuthority()) publishAuthState(true);
  }

  /**
   * Guest (or resume) applies the host's full valley snapshot.
   * Host ignores remote states — it is the source of truth.
   */
  function applyAuthState(snap, force = false) {
    if (!snap || snap.mode !== 'farmers') return false;
    if (!force && isAuthority()) return false;
    if (!Array.isArray(snap.players) || snap.players.length < 2) {
      // Legacy single-player save from the pre-shared-state build.
      if (me && snap.slot === me.slot) {
        const hydrated = hydratePlayer(snap, me.slot);
        match.players[me.slot] = hydrated;
        rebindPlayers();
        hudDirty = true;
      }
      return true;
    }

    gotAuthSnapshot = true;
    const snapGameId = snap.gameId || snap.roomId || null;
    if (snapGameId && cfg?.gameId && snapGameId !== cfg.gameId) {
      console.warn('Farmers auth state gameId mismatch', snapGameId, cfg.gameId);
      return false;
    }
    match = match || { gameId: snapGameId || cfg?.gameId || null, players: [null, null], elapsed: 0 };
    if (snapGameId) {
      match.gameId = snapGameId;
      if (cfg) {
        cfg.gameId = snapGameId;
        cfg.roomId = snapGameId;
      }
    }
    match.elapsed = Number(snap.elapsed) || match.elapsed || 0;
    const wasEnded = !!match.ended;
    match.ended = !!snap.ended;
    match.winnerSlot = match.ended && (snap.winnerSlot === 0 || snap.winnerSlot === 1)
      ? snap.winnerSlot
      : null;
    match.players[0] = hydratePlayer(snap.players[0], 0);
    match.players[1] = hydratePlayer(snap.players[1], 1);
    if (snap.moneyTree) {
      moneyTree.shake = Math.max(moneyTree.shake || 0, Number(snap.moneyTree.shake) || 0);
      moneyTree.sway = Number(snap.moneyTree.sway) || moneyTree.sway;
      moneyTree.clicks = Number(snap.moneyTree.clicks) || moneyTree.clicks;
    }
    rebindPlayers();
    if (me?.hint) setHint(me.hint);
    hudDirty = true;
    if (match.ended && !wasEnded) showEndScreen();
    else if (match.ended) showEndScreen();
    else hide($('farmers-end'));
    return true;
  }

  window.FARMERS_ONLINE = {
    start,
    cleanup,
    isActive: () => active,
    handleRemote,
    applyAuthState,
    applyForfeit,
  };
})();
