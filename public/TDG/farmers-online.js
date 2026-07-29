/**
 * Farmers — a peaceful, slow-and-steady farm market mode for Block Fortress / TDG.
 *
 * Both players share the Local Game map, one territory each, and never fight.
 * You unlock seeds at your shop, cover your land in farms, hire farmhands to
 * carry produce to your stand, and sell to wandering units. Money only goes up.
 *
 * Each client simulates its own farm and broadcasts a small status summary, so
 * the opponent's side is a live display rather than a synced simulation.
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
  const STATUS_BROADCAST_MS = 1500;
  const PERSIST_MS = 6000;

  // ─── Farm ladder — later seeds cost far more and sell for far more ────────
  const FARM_TYPES = [
    { id: 'wheat', name: 'Wheat', emoji: '🌾', crops: ['🌾'], unlock: 0, cost: 40, grow: 4.0, price: 2 },
    { id: 'carrot', name: 'Carrots', emoji: '🥕', crops: ['🥕'], unlock: 180, cost: 90, grow: 4.4, price: 4 },
    { id: 'corn', name: 'Corn', emoji: '🌽', crops: ['🌽'], unlock: 500, cost: 190, grow: 4.8, price: 8 },
    { id: 'tomato', name: 'Tomatoes', emoji: '🍅', crops: ['🍅'], unlock: 1400, cost: 400, grow: 5.2, price: 15 },
    { id: 'berry', name: 'Strawberries', emoji: '🍓', crops: ['🍓'], unlock: 3600, cost: 850, grow: 5.6, price: 28 },
    { id: 'pepper', name: 'Peppers', emoji: '🫑', crops: ['🫑', '🍆'], unlock: 9000, cost: 1800, grow: 6.0, price: 52 },
    { id: 'melon', name: 'Melons', emoji: '🍈', crops: ['🍈', '🍉'], unlock: 22000, cost: 3800, grow: 6.5, price: 95 },
    { id: 'sunflower', name: 'Golden Sunflowers', emoji: '🌻', crops: ['🌻'], unlock: 55000, cost: 8000, grow: 7.0, price: 180 },
  ];
  const FARM_BY_ID = {};
  for (const t of FARM_TYPES) FARM_BY_ID[t.id] = t;

  /** Each extra farm of a type costs more than the last. */
  const FARM_COST_GROWTH = 1.16;

  // ─── Per-farm-type skill tree: three branches, three tiers each ───────────
  const FARM_BRANCHES = [
    { id: 'growth', name: 'Growth', icon: '⏱️', blurb: 'Harvest arrives sooner' },
    { id: 'yield', name: 'Yield', icon: '🧺', blurb: 'More produce per harvest' },
    { id: 'quality', name: 'Quality', icon: '✨', blurb: 'Produce sells for more' },
  ];
  const BRANCH_MAX = 3;
  const BRANCH_TIER_COSTS = [1.6, 5, 15];
  const GROWTH_PER_TIER = 0.55;
  const YIELD_PER_TIER = 1;
  const QUALITY_PER_TIER = 0.3;

  // ─── Farmhands & dogs ─────────────────────────────────────────────────────
  const WORKER_BASE_COST = 120;
  const WORKER_COST_GROWTH = 1.4;
  const MAX_WORKERS = 10;
  const WORKER_SPEED = 52;
  const WORKER_CAPACITY = 4;

  const DOG_BASE_COST = 300;
  const DOG_COST_GROWTH = 1.55;
  const MAX_DOGS = 4;
  /** Each dog makes every farmhand this much quicker. */
  const DOG_SPEED_BONUS = 0.12;

  // ─── Stand ────────────────────────────────────────────────────────────────
  const STAND_UPGRADES = [500, 1600, 4800, 14000];
  const STAND_BASE_STOCK = 14;
  const STAND_STOCK_PER_LEVEL = 10;
  const STAND_BASE_CUSTOMER_GAP = 7.5;

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
  let me = null;
  let peer = null;
  let canvas = null;
  let ctx = null;
  let raf = 0;
  let lastTs = 0;
  let clock = 0;
  let lastStatusAt = 0;
  let lastPersistAt = 0;
  let lastPanelAt = -99;
  let selectedSeed = 'wheat';
  let treeType = 'wheat';
  let uiBound = false;
  let hudDirty = true;

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

  function freshFarmer(x, y) {
    return {
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
      placed: {},
      farms: [],
      farmers: [freshFarmer(lay.standX, lay.standY - 10)],
      dogs: [],
      stand: { level: 0, stock: [], customerAcc: 2 },
      customers: [],
      hint: 'Pick Wheat in the seed shop, then click your land to plant your first farm.',
    };
  }

  // ─── Derived stats ────────────────────────────────────────────────────────
  function growInterval(p, typeId) {
    const def = FARM_BY_ID[typeId];
    const tier = p.tree[typeId]?.growth || 0;
    return Math.max(1.2, def.grow - tier * GROWTH_PER_TIER);
  }

  function yieldPer(p, typeId) {
    return 1 + (p.tree[typeId]?.yield || 0) * YIELD_PER_TIER;
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

  function workerCost(p) {
    return Math.round(WORKER_BASE_COST * Math.pow(WORKER_COST_GROWTH, p.farmers.length - 1));
  }

  function dogCost(p) {
    return Math.round(DOG_BASE_COST * Math.pow(DOG_COST_GROWTH, p.dogs.length));
  }

  function workerSpeed(p) {
    return WORKER_SPEED * (1 + p.dogs.length * DOG_SPEED_BONUS);
  }

  function standCapacity(p) {
    return STAND_BASE_STOCK + p.stand.level * STAND_STOCK_PER_LEVEL;
  }

  function customerGap(p) {
    return Math.max(2.2, STAND_BASE_CUSTOMER_GAP - p.stand.level * 1.1);
  }

  /** Plots should always look planted; yield upgrades fill them in further. */
  function densityFor(p, typeId) {
    return clamp(2 + (p.tree[typeId]?.yield || 0), 2, 4);
  }

  // ─── Simulation (local player only) ───────────────────────────────────────
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

  function tickFarms(p, dt) {
    for (const farm of p.farms) {
      const interval = growInterval(p, farm.type);
      farm.acc += dt;
      if (farm.acc >= interval) {
        const cycles = Math.floor(farm.acc / interval);
        farm.acc -= cycles * interval;
        farm.ready = Math.min(24, (farm.ready || 0) + cycles * yieldPer(p, farm.type));
      }
      farm.progress = clamp(farm.acc / interval, 0, 0.999);
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
    const speed = workerSpeed(p);
    for (const farmer of p.farmers) {
      const before = { x: farmer.x, y: farmer.y };

      if (farmer.state === 'idle') {
        const idx = pickFarmFor(p, farmer);
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
            const room = WORKER_CAPACITY - farmer.carry.length;
            const take = Math.min(room, farm.ready);
            const value = unitPrice(p, farm.type);
            for (let i = 0; i < take; i++) farmer.carry.push({ v: value, e: farm.type });
            farm.ready -= take;
            farmer.target = -1;
            farmer.state = farmer.carry.length >= WORKER_CAPACITY ? 'to_stand' : 'idle';
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

    // Dogs trot after their farmhand.
    for (let i = 0; i < p.dogs.length; i++) {
      const dog = p.dogs[i];
      const host = p.farmers[i % p.farmers.length];
      if (!host) continue;
      const offset = (i % 2 === 0 ? -1 : 1) * 20;
      moveToward(dog, host.x + offset, host.y + 14, speed * 1.25, dt);
      dog.animT = (dog.animT || 0) + dt;
    }
  }

  function tickCustomers(p, dt) {
    const lay = sideLayout(p.slot);
    p.stand.customerAcc -= dt;
    if (p.stand.customerAcc <= 0 && p.customers.length < 7) {
      p.stand.customerAcc = customerGap(p) * (0.7 + Math.random() * 0.6);
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

  /** Richer stands attract the bigger-spending units. */
  function spawnCustomer(p) {
    const reach = clamp(2 + p.stand.level * 2 + Math.floor(p.sold / 60), 2, CUSTOMER_TYPES.length);
    const def = CUSTOMER_TYPES[Math.floor(Math.random() * reach)];
    // Everyone walks in off the bottom of the road so nobody pops in mid-field.
    return {
      type: def.type,
      want: def.want,
      tip: def.tip,
      size: def.size,
      x: ROAD_X + (Math.random() - 0.5) * 60,
      y: LAND_BOTTOM + 34,
      speed: 34 + Math.random() * 12,
      state: 'arrive',
      timer: 0,
      facing: 0,
      lane: (Math.random() - 0.5) * 44,
      animT: Math.random() * 3,
    };
  }

  function tickPeerDisplay(dt) {
    if (!peer) return;
    // The rival's side is a display: grow their crops and stroll their staff.
    for (const farm of peer.farms) {
      farm.acc = (farm.acc || 0) + dt;
      const interval = farm.grow || 4;
      if (farm.acc >= interval) farm.acc -= interval;
      farm.progress = clamp(farm.acc / interval, 0, 0.999);
    }
    for (const farmer of peer.farmers) {
      farmer.wanderT = (farmer.wanderT || Math.random() * 6) + dt;
      if (farmer.wanderT > 3.5) {
        farmer.wanderT = 0;
        const slotCount = peer.farms.length;
        const target = slotCount
          ? slotPosition(peer.slot, peer.farms[Math.floor(Math.random() * slotCount)].slot)
          : { x: peer.standX, y: peer.standY };
        farmer.tx = target.x;
        farmer.ty = target.y + 16;
      }
      if (farmer.tx != null) moveToward(farmer, farmer.tx, farmer.ty, 42, dt);
      farmer.animT = (farmer.animT || 0) + dt;
    }
  }

  // ─── Actions ──────────────────────────────────────────────────────────────
  function placeFarm(x, y) {
    if (!me) return;
    const def = FARM_BY_ID[selectedSeed];
    if (!def || !me.unlocked[def.id]) {
      setHint('Unlock that seed at your shop first.');
      return;
    }
    const cost = nextFarmCost(me, def.id);
    if (me.gold < cost) {
      setHint(`${def.name} costs ${money(cost)} — keep selling.`);
      return;
    }
    const spot = freeSlotNear(me, x, y);
    if (spot.slot < 0) {
      setHint('Your land is full of farms.');
      return;
    }
    me.gold -= cost;
    me.placed[def.id] = (me.placed[def.id] || 0) + 1;
    me.farms.push({ slot: spot.slot, type: def.id, acc: 0, ready: 0, progress: 0 });
    setHint(`${def.name} planted. Next one costs ${money(nextFarmCost(me, def.id))}.`);
    hudDirty = true;
  }

  function unlockSeed(typeId) {
    const def = FARM_BY_ID[typeId];
    if (!me || !def || me.unlocked[typeId]) return;
    if (me.gold < def.unlock) {
      setHint(`${def.name} seeds cost ${money(def.unlock)}.`);
      return;
    }
    me.gold -= def.unlock;
    me.unlocked[typeId] = true;
    selectedSeed = typeId;
    treeType = typeId;
    setHint(`${def.name} unlocked — sells for ${money(def.price)} each.`);
    hudDirty = true;
  }

  function buyBranch(typeId, branchId) {
    if (!me || !me.unlocked[typeId]) return;
    const rec = me.tree[typeId];
    const tier = rec[branchId] || 0;
    if (tier >= BRANCH_MAX) return;
    const cost = branchCost(typeId, branchId, tier);
    if (me.gold < cost) {
      setHint(`That upgrade costs ${money(cost)}.`);
      return;
    }
    me.gold -= cost;
    rec[branchId] = tier + 1;
    const def = FARM_BY_ID[typeId];
    setHint(`${def.name} ${branchId} upgraded to ${rec[branchId]}/${BRANCH_MAX}.`);
    hudDirty = true;
  }

  function hireFarmer() {
    if (!me || me.farmers.length >= MAX_WORKERS) return;
    const cost = workerCost(me);
    if (me.gold < cost) {
      setHint(`A farmhand costs ${money(cost)}.`);
      return;
    }
    const lay = sideLayout(me.slot);
    me.gold -= cost;
    me.farmers.push(freshFarmer(lay.standX - lay.dir * 30, lay.standY + 8));
    setHint(`Farmhand hired (${me.farmers.length}/${MAX_WORKERS}).`);
    hudDirty = true;
  }

  function buyDog() {
    if (!me || me.dogs.length >= MAX_DOGS) return;
    const cost = dogCost(me);
    if (me.gold < cost) {
      setHint(`A farm dog costs ${money(cost)}.`);
      return;
    }
    const lay = sideLayout(me.slot);
    me.gold -= cost;
    me.dogs.push({ x: lay.standX, y: lay.standY + 20, facing: 0, animT: 0 });
    setHint('A dog joins the farm — every farmhand moves quicker.');
    hudDirty = true;
  }

  function upgradeStand() {
    if (!me || me.stand.level >= STAND_UPGRADES.length) return;
    const cost = STAND_UPGRADES[me.stand.level];
    if (me.gold < cost) {
      setHint(`Stand upgrade costs ${money(cost)}.`);
      return;
    }
    me.gold -= cost;
    me.stand.level += 1;
    setHint('Stand upgraded — busier customers, bigger shelves, better prices.');
    hudDirty = true;
  }

  function setHint(text) {
    if (!me) return;
    me.hint = text;
    const el = $('farmers-hint');
    if (el) el.textContent = text;
  }

  // ─── Peer status exchange ─────────────────────────────────────────────────
  function statusPayload() {
    return {
      type: 'farmers_status',
      name: me.name,
      gold: Math.floor(me.gold),
      sold: me.sold,
      workers: me.farmers.length,
      dogs: me.dogs.length,
      standLevel: me.stand.level,
      stock: me.stand.stock.length,
      farms: me.farms.map((f) => ({ s: f.slot, t: f.type })),
    };
  }

  function broadcastStatus() {
    if (!me || cfg?.solo) return;
    lastStatusAt = clock;
    window.TDG_PVP?.sendAction?.(statusPayload());
  }

  function applyPeerStatus(data) {
    if (!peer || !data) return;
    peer.name = data.name || peer.name;
    peer.gold = Number(data.gold) || 0;
    peer.sold = Number(data.sold) || 0;
    peer.standLevel = Number(data.standLevel) || 0;
    peer.stock = Number(data.stock) || 0;
    peer.dogCount = Number(data.dogs) || 0;

    const incoming = Array.isArray(data.farms) ? data.farms : [];
    const bySlot = new Map(peer.farms.map((f) => [f.slot, f]));
    peer.farms = incoming.map((f) => {
      const existing = bySlot.get(f.s);
      const def = FARM_BY_ID[f.t] || FARM_TYPES[0];
      return existing && existing.type === f.t
        ? existing
        : { slot: f.s, type: f.t, acc: Math.random() * def.grow, grow: def.grow, progress: 0 };
    });

    const wanted = clamp(Number(data.workers) || 1, 0, MAX_WORKERS);
    while (peer.farmers.length < wanted) {
      peer.farmers.push({ x: peer.standX, y: peer.standY, facing: 0, animT: 0 });
    }
    if (peer.farmers.length > wanted) peer.farmers.length = wanted;
    hudDirty = true;
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
    const used = new Set(me.farms.map((f) => f.slot));
    if (used.size >= FARM_SLOTS) return;
    const def = FARM_BY_ID[selectedSeed];
    const affordable = def && me.unlocked[def.id] && me.gold >= nextFarmCost(me, def.id);
    ctx.save();
    ctx.setLineDash([5, 6]);
    ctx.lineWidth = 1.5;
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
      const density = isMine ? densityFor(state, farm.type) : 2;
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
      if (isMine && farm.ready > 0) {
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
    const level = isMine ? state.stand.level : (state.standLevel || 0);
    const stock = isMine ? state.stand.stock.length : (state.stock || 0);
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
    const label = isMine || !state.solo ? `${state.name} · ${money(state.gold)}` : state.name;
    ctx.fillText(label, x, y + 40);
    if (isMine || !state.solo) {
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = '10px Rajdhani, sans-serif';
      ctx.fillText(`Stand Lv ${level + 1} · ${stock} ready`, x, y + 53);
    }
    ctx.restore();
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
      drawActor('farmer', farmer, 20, { moveSpeed: farmer.moving ? 40 : 0, ownerId });
      if (isMine && farmer.carry?.length) {
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
    const dogs = isMine ? state.dogs : [];
    for (const dog of dogs) drawActor('speed', dog, 20, { moveSpeed: 30, ownerId });
    if (isMine) {
      for (const c of state.customers) {
        drawActor(c.type, c, c.size * 0.78, { moveSpeed: c.state === 'buying' ? 0 : 30, ownerId });
        if (c.state === 'buying') {
          ctx.textAlign = 'center';
          ctx.font = '13px serif';
          ctx.fillText('💰', c.x, c.y - c.size * 0.78 - 8);
        }
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
    set('farmers-them-gold', peer && !peer.solo ? money(peer.gold) : '—');
    set('farmers-stock', `${me.stand.stock.length}/${standCapacity(me)}`);
    set('farmers-workers', `${me.farmers.length}/${MAX_WORKERS}`);
    set('farmers-dogs', `${me.dogs.length}/${MAX_DOGS}`);
    set('farmers-farmcount', `${me.farms.length}/${FARM_SLOTS}`);
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
      const rows = FARM_BRANCHES.map((branch) => {
        const tier = rec[branch.id] || 0;
        const maxed = tier >= BRANCH_MAX;
        const cost = maxed ? 0 : branchCost(treeType, branch.id, tier);
        const pips = Array.from({ length: BRANCH_MAX }, (_, i) =>
          `<i class="farmers-pip${i < tier ? ' on' : ''}"></i>`).join('');
        const btn = maxed
          ? '<span class="farmers-branch-max">MAX</span>'
          : `<button type="button" class="farmers-branch-buy" data-branch="${branch.id}"${me.gold >= cost ? '' : ' disabled'}>${money(cost)}</button>`;
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
      const per = yieldPer(me, treeType);
      treeBody.innerHTML = `<div class="farmers-tree-head">${def.emoji} ${def.name} — ${per} crop${per === 1 ? '' : 's'} every ${growInterval(me, treeType).toFixed(1)}s, ${money(unitPrice(me, treeType))} each</div>${rows}`;
    }

    const wCost = me.farmers.length >= MAX_WORKERS ? null : workerCost(me);
    const dCost = me.dogs.length >= MAX_DOGS ? null : dogCost(me);
    const sCost = me.stand.level >= STAND_UPGRADES.length ? null : STAND_UPGRADES[me.stand.level];
    setBtn('farmers-btn-hire', wCost == null ? 'Farmhands full' : `Hire Farmhand ${money(wCost)}`, wCost != null && me.gold >= wCost);
    setBtn('farmers-btn-dog', dCost == null ? 'Dog pack full' : `Buy Farm Dog ${money(dCost)}`, dCost != null && me.gold >= dCost);
    setBtn('farmers-btn-stand', sCost == null ? 'Stand maxed' : `Upgrade Stand ${money(sCost)}`, sCost != null && me.gold >= sCost);
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
    if (!me) return;
    const pt = canvasToLogic(e.clientX, e.clientY);
    const spot = freeSlotNear(me, pt.x, pt.y);
    if (spot.slot < 0) {
      setHint('Your land is full of farms.');
      return;
    }
    if (spot.dist > 150) {
      setHint('Click your own side of the road to plant.');
      return;
    }
    placeFarm(pt.x, pt.y);
  }

  function bindUi() {
    $('farmers-seed-row')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-seed]');
      if (!btn) return;
      const id = btn.getAttribute('data-seed');
      if (me?.unlocked[id]) {
        selectedSeed = id;
        treeType = id;
        setHint(`${FARM_BY_ID[id].name} selected — click your land to plant.`);
        hudDirty = true;
      } else {
        unlockSeed(id);
      }
    });
    $('farmers-tree-tabs')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-tree]');
      if (!btn) return;
      treeType = btn.getAttribute('data-tree');
      hudDirty = true;
    });
    $('farmers-tree-body')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-branch]');
      if (!btn) return;
      buyBranch(treeType, btn.getAttribute('data-branch'));
    });
    $('farmers-btn-hire')?.addEventListener('click', hireFarmer);
    $('farmers-btn-dog')?.addEventListener('click', buyDog);
    $('farmers-btn-stand')?.addEventListener('click', upgradeStand);
    $('farmers-howto-btn')?.addEventListener('click', () => show($('farmers-howto')));
    $('farmers-howto-close')?.addEventListener('click', () => hide($('farmers-howto')));
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
    const dt = clamp((ts - lastTs) / 1000, 0, 0.05);
    lastTs = ts;
    clock += dt;

    if (me) {
      tickFarms(me, dt);
      tickFarmers(me, dt);
      tickCustomers(me, dt);
    }
    tickPeerDisplay(dt);

    renderScene();
    renderReadouts();
    // Prices/affordability shift as gold climbs, so refresh the panels on a slow beat.
    if (hudDirty || clock - lastPanelAt > 1) {
      lastPanelAt = clock;
      renderPanels();
    }

    if (clock - lastStatusAt > STATUS_BROADCAST_MS / 1000) broadcastStatus();
    if (clock - lastPersistAt > PERSIST_MS / 1000) {
      lastPersistAt = clock;
      window.TDG_PVP?.persistLiveState?.(serialize(), { mode: 'farmers' });
    }
  }

  // ─── Save / restore ───────────────────────────────────────────────────────
  function serialize() {
    return {
      mode: 'farmers',
      slot: me.slot,
      gold: me.gold,
      earned: me.earned,
      sold: me.sold,
      unlocked: me.unlocked,
      tree: me.tree,
      placed: me.placed,
      farms: me.farms.map((f) => ({ slot: f.slot, type: f.type, acc: f.acc, ready: f.ready })),
      workers: me.farmers.length,
      dogs: me.dogs.length,
      standLevel: me.stand.level,
    };
  }

  function restore(saved) {
    if (!saved || saved.mode !== 'farmers') return;
    me.gold = Number(saved.gold) || START_GOLD;
    me.earned = Number(saved.earned) || 0;
    me.sold = Number(saved.sold) || 0;
    me.unlocked = saved.unlocked || { wheat: true };
    me.placed = saved.placed || {};
    me.stand.level = clamp(Number(saved.standLevel) || 0, 0, STAND_UPGRADES.length);
    const tree = freshTree();
    for (const id of Object.keys(tree)) {
      if (saved.tree?.[id]) Object.assign(tree[id], saved.tree[id]);
    }
    me.tree = tree;
    me.farms = (saved.farms || [])
      .filter((f) => FARM_BY_ID[f.type])
      .map((f) => ({ slot: f.slot, type: f.type, acc: f.acc || 0, ready: f.ready || 0, progress: 0 }));
    const lay = sideLayout(me.slot);
    const workers = clamp(Number(saved.workers) || 1, 1, MAX_WORKERS);
    me.farmers = Array.from({ length: workers }, () => freshFarmer(lay.standX, lay.standY - 10));
    me.dogs = Array.from({ length: clamp(Number(saved.dogs) || 0, 0, MAX_DOGS) }, () => ({
      x: lay.standX,
      y: lay.standY + 20,
      facing: 0,
      animT: 0,
    }));
    const firstUnlocked = FARM_TYPES.find((d) => me.unlocked[d.id]);
    selectedSeed = firstUnlocked ? firstUnlocked.id : 'wheat';
    treeType = selectedSeed;
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────
  function start(opts) {
    cleanup(false);
    const mySlot = opts.myPlayerId === 1 ? 1 : 0;
    const theirSlot = mySlot === 0 ? 1 : 0;
    const myName = mySlot === 0 ? opts.player0Name : opts.player1Name;
    const theirName = mySlot === 0 ? opts.player1Name : opts.player0Name;

    cfg = { myPlayerId: mySlot, roomId: opts.roomId, isHost: !!opts.isHost, solo: !!opts.solo };
    me = freshPlayer(myName || 'You', mySlot);

    const theirLay = sideLayout(theirSlot);
    peer = {
      name: theirName || 'Rival',
      slot: theirSlot,
      solo: !!opts.solo,
      gold: START_GOLD,
      sold: 0,
      stock: 0,
      standLevel: 0,
      dogCount: 0,
      farms: [],
      farmers: [{ x: theirLay.standX, y: theirLay.standY, facing: 0, animT: 0 }],
      standX: theirLay.standX,
      standY: theirLay.standY,
    };
    if (opts.solo) {
      // Nobody home next door — leave a few sleepy plots so the valley looks lived in.
      peer.farms = [0, 5, 9].map((slot) => ({
        slot,
        type: 'wheat',
        acc: Math.random() * 4,
        grow: 4,
        progress: 0,
      }));
    }

    if (opts.savedState) restore(opts.savedState);

    active = true;
    lastTs = 0;
    clock = 0;
    lastStatusAt = -99;
    lastPersistAt = 0;
    hudDirty = true;

    hide($('menu-screen'));
    hide($('online-match-screen'));
    hide($('online-queue-screen'));
    hide($('tft-game-screen'));
    hide($('farmers-howto'));
    show($('farmers-game-screen'));

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

    setHint(me.hint);
    renderReadouts();
    renderPanels();
    renderScene();
    raf = requestAnimationFrame(loop);
    broadcastStatus();
  }

  function cleanup(hard) {
    active = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (hard) {
      me = null;
      peer = null;
      cfg = null;
      hide($('farmers-game-screen'));
    }
  }

  function handleRemote(from, action) {
    if (!active || !action) return false;
    const nested = action.action && action.action.type ? action.action : action;
    if (nested.type !== 'farmers_status') return false;
    if (from === cfg?.myPlayerId) return true;
    applyPeerStatus(nested);
    return true;
  }

  /** Peaceful mode: a departing rival just leaves an empty stall behind. */
  function applyForfeit(fromSlot) {
    if (!peer || fromSlot === cfg?.myPlayerId) return;
    peer.gone = true;
    setHint(`${peer.name} packed up and left. Your farm keeps going.`);
  }

  function applyAuthState(snap) {
    if (!snap || snap.mode !== 'farmers' || !me) return;
    // Only used to seed a resumed session; live play is simulated locally.
    if (!me.farms.length && snap.slot === me.slot) restore(snap);
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
