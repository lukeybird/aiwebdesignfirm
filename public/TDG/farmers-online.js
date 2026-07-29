/**
 * Farmers — slow-pace 1v1 farm market multiplayer for Block Fortress / TDG.
 * Host-authoritative over Pusher (same path as TFT). Produce → haul → stand → customers.
 */
(function () {
  'use strict';

  const START_GOLD = 55;
  const WIN_GOLD = 400;
  const MATCH_SECONDS = 10 * 60;
  const HARVEST_BASE = 4;
  const ECON_BRANCH_COSTS = [300, 900, 3200];
  const ECON_BRANCH_MAX = 3;
  const YIELD_BY_LEVEL = [1, 2, 3, 5];
  const HIRE_BASE = 70;
  const HIRE_STEP = 30;
  const STAND_UPGRADE_COSTS = [120, 280, 520];
  const AUTH_SYNC_MS = 220;
  const LOGIC_W = 720;
  const LOGIC_H = 420;
  const MAX_WORKERS = 8;
  const MAX_FARMS = 4;

  const SEEDS = {
    wheat: { id: 'wheat', name: 'Wheat', cost: 18, price: 2, growMod: -0.4, color: '#d4a017', emoji: '🌾' },
    apple: { id: 'apple', name: 'Apple', cost: 28, price: 3, growMod: 0, color: '#c0392b', emoji: '🍎' },
    berry: { id: 'berry', name: 'Berry', cost: 48, price: 5, growMod: 0.2, color: '#8e44ad', emoji: '🫐' },
    melon: { id: 'melon', name: 'Melon', cost: 85, price: 9, growMod: 0.6, color: '#27ae60', emoji: '🍈' },
  };

  let active = false;
  let cfg = null;
  let match = null;
  let raf = 0;
  let lastTs = 0;
  let lastSync = 0;
  let ended = false;
  let canvas = null;
  let ctx = null;
  let pointer = { x: 0, y: 0, down: false };

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

  function harvestInterval(farmSpeed, growMod) {
    return Math.max(1.2, HARVEST_BASE - farmSpeed + (growMod || 0));
  }

  function yieldAmount(yieldLvl) {
    return YIELD_BY_LEVEL[clamp(yieldLvl, 0, YIELD_BY_LEVEL.length - 1)] || 1;
  }

  function hireCost(workerCount) {
    return HIRE_BASE + Math.max(0, workerCount - 1) * HIRE_STEP;
  }

  function freshFarm(x, y, seedId) {
    return {
      x,
      y,
      seedId: seedId || 'apple',
      acc: 0,
      buffer: 0,
      maxBuffer: 12,
    };
  }

  function freshWorker(x, y) {
    return {
      x,
      y,
      vx: 0,
      vy: 0,
      state: 'idle', // idle | to_farm | carry | to_stand
      carry: 0,
      carrySeed: null,
      targetFarm: -1,
      speed: 48,
    };
  }

  function freshCustomer(side) {
    const fromLeft = Math.random() < 0.5;
    return {
      x: fromLeft ? -20 : LOGIC_W + 20,
      y: 340 + Math.random() * 40,
      speed: 28 + Math.random() * 14,
      state: 'to_stand', // to_stand | buying | leave
      buyTimer: 0,
      side,
      want: 1 + (Math.random() < 0.35 ? 1 : 0),
    };
  }

  function freshPlayer(name, slot) {
    const standX = slot === 0 ? 160 : 560;
    return {
      name: name || (slot === 0 ? 'Farmer A' : 'Farmer B'),
      slot,
      gold: START_GOLD,
      earned: 0,
      sold: 0,
      farms: [],
      workers: [freshWorker(standX, 280)],
      stand: {
        x: standX,
        y: 300,
        stock: 0,
        stockSeed: 'apple',
        level: 0,
        custAcc: 0,
      },
      seed: 'apple',
      farmSpeed: 0,
      farmYield: 0,
      customers: [],
      placedFirstFarm: false,
      hint: 'Place your first farm on the field.',
    };
  }

  function createMatch(opts) {
    const p0 = opts.player0Name || 'You';
    const p1 = opts.player1Name || 'Opponent';
    return {
      mode: 'farmers',
      startedAt: Date.now(),
      elapsed: 0,
      winnerSlot: null,
      endReason: null,
      players: [freshPlayer(p0, 0), freshPlayer(p1, 1)],
      seq: 0,
    };
  }

  function serializeMatch() {
    return JSON.parse(JSON.stringify(match));
  }

  function customerInterval(standLevel) {
    return Math.max(3.5, 9 - standLevel * 1.6);
  }

  function nearestFarmWithFruit(p, worker) {
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < p.farms.length; i++) {
      const f = p.farms[i];
      if (!f.buffer) continue;
      const dx = f.x - worker.x;
      const dy = f.y - worker.y;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }

  function moveToward(ent, tx, ty, speed, dt) {
    const dx = tx - ent.x;
    const dy = ty - ent.y;
    const dist = Math.hypot(dx, dy) || 1;
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

  function tickPlayer(p, dt) {
    // Farm production
    for (const farm of p.farms) {
      const seed = SEEDS[farm.seedId] || SEEDS.apple;
      const interval = harvestInterval(p.farmSpeed, seed.growMod);
      farm.acc += dt;
      while (farm.acc >= interval && farm.buffer < farm.maxBuffer) {
        farm.acc -= interval;
        farm.buffer = Math.min(farm.maxBuffer, farm.buffer + yieldAmount(p.farmYield));
      }
      if (farm.buffer >= farm.maxBuffer) farm.acc = Math.min(farm.acc, interval);
    }

    // Workers
    for (const w of p.workers) {
      if (w.state === 'idle') {
        const fi = nearestFarmWithFruit(p, w);
        if (fi >= 0) {
          w.state = 'to_farm';
          w.targetFarm = fi;
        }
      } else if (w.state === 'to_farm') {
        const farm = p.farms[w.targetFarm];
        if (!farm || !farm.buffer) {
          w.state = 'idle';
          w.targetFarm = -1;
          continue;
        }
        if (moveToward(w, farm.x, farm.y - 18, w.speed, dt)) {
          const take = Math.min(3, farm.buffer);
          farm.buffer -= take;
          w.carry = take;
          w.carrySeed = farm.seedId;
          w.state = 'to_stand';
          w.targetFarm = -1;
        }
      } else if (w.state === 'to_stand') {
        if (moveToward(w, p.stand.x, p.stand.y - 22, w.speed, dt)) {
          p.stand.stock += w.carry;
          if (w.carrySeed) p.stand.stockSeed = w.carrySeed;
          w.carry = 0;
          w.carrySeed = null;
          w.state = 'idle';
        }
      }
    }

    // Spawn customers
    p.stand.custAcc += dt;
    const cInt = customerInterval(p.stand.level);
    while (p.stand.custAcc >= cInt) {
      p.stand.custAcc -= cInt;
      if (p.customers.length < 6) p.customers.push(freshCustomer(p.slot));
    }

    // Customers buy
    for (let i = p.customers.length - 1; i >= 0; i--) {
      const c = p.customers[i];
      if (c.state === 'to_stand') {
        if (moveToward(c, p.stand.x + (c.x < p.stand.x ? -14 : 14), p.stand.y + 8, c.speed, dt)) {
          c.state = 'buying';
          c.buyTimer = 0.7 + Math.random() * 0.5;
        }
      } else if (c.state === 'buying') {
        c.buyTimer -= dt;
        if (c.buyTimer <= 0) {
          const seed = SEEDS[p.stand.stockSeed] || SEEDS.apple;
          const buy = Math.min(c.want, p.stand.stock);
          if (buy > 0) {
            p.stand.stock -= buy;
            const pay = buy * seed.price;
            p.gold += pay;
            p.earned += pay;
            p.sold += buy;
          }
          c.state = 'leave';
          c.leaveX = c.x < LOGIC_W / 2 ? -40 : LOGIC_W + 40;
        }
      } else if (c.state === 'leave') {
        if (moveToward(c, c.leaveX, c.y + (Math.random() - 0.5) * 2, c.speed * 1.15, dt)) {
          p.customers.splice(i, 1);
        }
      }
    }
  }

  function checkWin() {
    if (ended || !match) return;
    const a = match.players[0];
    const b = match.players[1];
    if (a.gold >= WIN_GOLD || b.gold >= WIN_GOLD) {
      if (a.gold >= WIN_GOLD && b.gold >= WIN_GOLD) {
        endMatch(a.gold >= b.gold ? 0 : 1, 'goal');
      } else {
        endMatch(a.gold >= WIN_GOLD ? 0 : 1, 'goal');
      }
      return;
    }
    if (match.elapsed >= MATCH_SECONDS) {
      if (a.gold === b.gold) endMatch(null, 'draw');
      else endMatch(a.gold > b.gold ? 0 : 1, 'time');
    }
  }

  function endMatch(winnerSlot, reason) {
    if (ended) return;
    ended = true;
    match.winnerSlot = winnerSlot;
    match.endReason = reason;
    updateEndUi();
    if (cfg?.isHost) {
      window.TDG_PVP?.sendState?.(serializeMatch());
      window.TDG_PVP?.notifyGameOver?.({
        winnerSlot,
        endReason: winnerSlot == null ? 'draw' : 'base_destroyed',
      });
    }
  }

  function applyAction(fromSlot, action) {
    if (!match || ended || !action) return;
    const p = match.players[fromSlot];
    if (!p) return;
    const type = action.type;

    if (type === 'farmers_place_farm') {
      if (p.farms.length >= MAX_FARMS) return;
      const cost = p.placedFirstFarm ? 95 : 0;
      if (p.gold < cost) return;
      const halfMin = p.slot === 0 ? 40 : LOGIC_W / 2 + 20;
      const halfMax = p.slot === 0 ? LOGIC_W / 2 - 20 : LOGIC_W - 40;
      const x = clamp(Number(action.x) || (halfMin + halfMax) / 2, halfMin, halfMax);
      const y = clamp(Number(action.y) || 160, 70, 250);
      p.gold -= cost;
      p.farms.push(freshFarm(x, y, p.seed));
      p.placedFirstFarm = true;
      p.hint = p.farms.length === 1
        ? 'Workers haul crops to your stand. Buy seeds & upgrades.'
        : 'Farm placed. Keep upgrading yield and speed.';
      return;
    }

    if (type === 'farmers_buy_seed') {
      const seed = SEEDS[action.seedId];
      if (!seed) return;
      if (p.gold < seed.cost) return;
      p.gold -= seed.cost;
      p.seed = seed.id;
      for (const f of p.farms) f.seedId = seed.id;
      p.hint = `Planted ${seed.name}. Customers pay $${seed.price} each.`;
      return;
    }

    if (type === 'farmers_hire') {
      if (p.workers.length >= MAX_WORKERS) return;
      const cost = hireCost(p.workers.length);
      if (p.gold < cost) return;
      p.gold -= cost;
      p.workers.push(freshWorker(p.stand.x + (Math.random() * 20 - 10), p.stand.y - 10));
      p.hint = `Hired a hand (${p.workers.length} workers).`;
      return;
    }

    if (type === 'farmers_upgrade_speed') {
      if (p.farmSpeed >= ECON_BRANCH_MAX) return;
      const cost = ECON_BRANCH_COSTS[p.farmSpeed];
      if (p.gold < cost) return;
      p.gold -= cost;
      p.farmSpeed += 1;
      p.hint = `Farm speed +1 (harvest every ${harvestInterval(p.farmSpeed, SEEDS[p.seed]?.growMod || 0).toFixed(1)}s).`;
      return;
    }

    if (type === 'farmers_upgrade_yield') {
      if (p.farmYield >= ECON_BRANCH_MAX) return;
      const cost = ECON_BRANCH_COSTS[p.farmYield];
      if (p.gold < cost) return;
      p.gold -= cost;
      p.farmYield += 1;
      p.hint = `Farm yield +1 (${yieldAmount(p.farmYield)} fruit / harvest).`;
      return;
    }

    if (type === 'farmers_upgrade_stand') {
      if (p.stand.level >= STAND_UPGRADE_COSTS.length) return;
      const cost = STAND_UPGRADE_COSTS[p.stand.level];
      if (p.gold < cost) return;
      p.gold -= cost;
      p.stand.level += 1;
      p.hint = `Stand upgraded — customers arrive faster.`;
      return;
    }
  }

  function dispatchLocal(action) {
    if (!cfg || ended) return;
    if (cfg.isHost) {
      applyAction(cfg.myPlayerId, action);
      pushSync(true);
    } else {
      // Optimistic local apply for feel; host remains authority.
      applyAction(cfg.myPlayerId, action);
      window.TDG_PVP?.sendAction?.({ type: action.type, ...action, farmers: true });
    }
    renderHud();
  }

  function pushSync(force) {
    if (!cfg?.isHost || !match) return;
    const now = performance.now();
    if (!force && now - lastSync < AUTH_SYNC_MS) return;
    lastSync = now;
    match.seq = (match.seq || 0) + 1;
    window.TDG_PVP?.sendState?.(serializeMatch());
  }

  function applyAuthState(snap) {
    if (!snap || snap.mode !== 'farmers') return;
    const wasEnded = ended;
    match = snap;
    if (snap.winnerSlot != null || snap.endReason) {
      ended = true;
      updateEndUi();
    } else {
      ended = false;
    }
    if (!wasEnded && ended && cfg && !cfg.isHost) {
      // Guest acknowledges end UI only; host already reported.
    }
    renderHud();
  }

  function handleRemote(from, action) {
    if (!cfg?.isHost || !action) return;
    if (!String(action.type || '').startsWith('farmers_')) return;
    applyAction(from, action);
    pushSync(true);
  }

  function applyForfeit(fromSlot) {
    if (ended) return;
    const winner = fromSlot === 0 ? 1 : 0;
    endMatch(winner, 'forfeit');
  }

  function canvasToLogic(clientX, clientY) {
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * LOGIC_W;
    const y = ((clientY - rect.top) / rect.height) * LOGIC_H;
    return { x, y };
  }

  function onCanvasClick(e) {
    if (!match || ended || !cfg) return;
    const me = match.players[cfg.myPlayerId];
    if (!me) return;
    const pt = canvasToLogic(e.clientX, e.clientY);
    const halfMin = cfg.myPlayerId === 0 ? 40 : LOGIC_W / 2 + 20;
    const halfMax = cfg.myPlayerId === 0 ? LOGIC_W / 2 - 20 : LOGIC_W - 40;
    // Place farm in your half of the planting band
    if (pt.y >= 60 && pt.y <= 250 && pt.x >= halfMin - 10 && pt.x <= halfMax + 10) {
      dispatchLocal({ type: 'farmers_place_farm', x: pt.x, y: pt.y });
    }
  }

  function drawRounded(x, y, w, h, r, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  function drawFarmPlot(p, accent) {
    // Ground strip for this player
    for (const farm of p.farms) {
      const seed = SEEDS[farm.seedId] || SEEDS.apple;
      drawRounded(farm.x - 28, farm.y - 18, 56, 40, 8, '#3d6b3d', '#2a4a2a');
      ctx.fillStyle = seed.color;
      ctx.beginPath();
      ctx.arc(farm.x, farm.y - 4, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${farm.buffer}`, farm.x, farm.y + 28);
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = '10px sans-serif';
      ctx.fillText(seed.emoji, farm.x, farm.y - 22);
    }

    // Stand
    drawRounded(p.stand.x - 36, p.stand.y - 28, 72, 48, 6, '#8b5a2b', '#5c3a18');
    ctx.fillStyle = '#f5e6c8';
    ctx.fillRect(p.stand.x - 30, p.stand.y - 22, 60, 14);
    ctx.fillStyle = '#1a1208';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Stand · ${p.stand.stock}`, p.stand.x, p.stand.y - 11);
    ctx.fillStyle = accent;
    ctx.font = '10px sans-serif';
    ctx.fillText(p.name, p.stand.x, p.stand.y + 30);

    // Workers
    for (const w of p.workers) {
      ctx.fillStyle = '#c4a574';
      ctx.beginPath();
      ctx.arc(w.x, w.y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#5c4030';
      ctx.stroke();
      if (w.carry > 0) {
        const seed = SEEDS[w.carrySeed] || SEEDS.apple;
        ctx.fillStyle = seed.color;
        ctx.beginPath();
        ctx.arc(w.x + 8, w.y - 8, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Customers
    for (const c of p.customers) {
      ctx.fillStyle = '#6b8cae';
      ctx.beginPath();
      ctx.arc(c.x, c.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🛒', c.x, c.y - 12);
    }
  }

  function renderCanvas() {
    if (!ctx || !match || !cfg) return;
    ctx.clearRect(0, 0, LOGIC_W, LOGIC_H);

    // Sky / field
    const g = ctx.createLinearGradient(0, 0, 0, LOGIC_H);
    g.addColorStop(0, '#7eb6d9');
    g.addColorStop(0.45, '#a8d4a0');
    g.addColorStop(1, '#6b9e5e');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, LOGIC_W, LOGIC_H);

    // Planting band hint
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(0, 60, LOGIC_W, 190);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.setLineDash([6, 6]);
    ctx.strokeRect(8, 64, LOGIC_W - 16, 182);
    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(20,30,20,0.55)';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Click YOUR half to place a farm', 16, 82);

    // Midline between players
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(LOGIC_W / 2, 60);
    ctx.lineTo(LOGIC_W / 2, 300);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('You ←' , cfg.myPlayerId === 0 ? LOGIC_W * 0.25 : LOGIC_W * 0.75, 100);
    ctx.fillText('→ Rival', cfg.myPlayerId === 0 ? LOGIC_W * 0.75 : LOGIC_W * 0.25, 100);

    // Path / market road
    ctx.fillStyle = '#c2a878';
    ctx.fillRect(0, 310, LOGIC_W, 70);

    const me = match.players[cfg.myPlayerId];
    const them = match.players[cfg.myPlayerId === 0 ? 1 : 0];
    drawFarmPlot(them, '#FF8E53');
    drawFarmPlot(me, '#4ECDC4');

    // Goal banner
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    drawRounded(LOGIC_W / 2 - 110, 8, 220, 28, 8, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = '#f5f0e6';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`First to $${WIN_GOLD}`, LOGIC_W / 2, 27);
  }

  function renderHud() {
    if (!match || !cfg) return;
    const me = match.players[cfg.myPlayerId];
    const them = match.players[cfg.myPlayerId === 0 ? 1 : 0];
    const set = (id, text) => {
      const el = $(id);
      if (el) el.textContent = text;
    };

    set('farmers-you-name', me.name);
    set('farmers-them-name', them.name);
    set('farmers-you-gold', `$${Math.floor(me.gold)}`);
    set('farmers-them-gold', `$${Math.floor(them.gold)}`);
    set('farmers-you-stock', String(me.stand.stock));
    set('farmers-them-stock', String(them.stand.stock));
    set('farmers-hint', me.hint || '');

    const left = Math.max(0, MATCH_SECONDS - match.elapsed);
    const m = Math.floor(left / 60);
    const s = Math.floor(left % 60);
    set('farmers-timer', `${m}:${String(s).padStart(2, '0')}`);

    const youBar = $('farmers-you-bar');
    const themBar = $('farmers-them-bar');
    if (youBar) youBar.style.width = `${clamp((me.gold / WIN_GOLD) * 100, 0, 100)}%`;
    if (themBar) themBar.style.width = `${clamp((them.gold / WIN_GOLD) * 100, 0, 100)}%`;

    // Shop buttons
    const seedRow = $('farmers-seed-row');
    if (seedRow) {
      seedRow.innerHTML = Object.values(SEEDS).map((seed) => {
        const activeSeed = me.seed === seed.id ? ' is-active' : '';
        return `<button type="button" class="farmers-chip${activeSeed}" data-seed="${seed.id}" ${me.gold < seed.cost && me.seed !== seed.id ? 'disabled' : ''}>${seed.emoji} ${seed.name}<span>$${seed.cost} · sell $${seed.price}</span></button>`;
      }).join('');
    }

    const speedCost = me.farmSpeed < ECON_BRANCH_MAX ? ECON_BRANCH_COSTS[me.farmSpeed] : null;
    const yieldCost = me.farmYield < ECON_BRANCH_MAX ? ECON_BRANCH_COSTS[me.farmYield] : null;
    const standCost = me.stand.level < STAND_UPGRADE_COSTS.length ? STAND_UPGRADE_COSTS[me.stand.level] : null;
    const hCost = me.workers.length < MAX_WORKERS ? hireCost(me.workers.length) : null;

    setBtn('farmers-btn-speed', speedCost == null ? 'Speed MAX' : `Farm Speed $${speedCost}`, speedCost != null && me.gold >= speedCost);
    setBtn('farmers-btn-yield', yieldCost == null ? 'Yield MAX' : `Farm Yield $${yieldCost}`, yieldCost != null && me.gold >= yieldCost);
    setBtn('farmers-btn-stand', standCost == null ? 'Stand MAX' : `Stand Upgrade $${standCost}`, standCost != null && me.gold >= standCost);
    setBtn('farmers-btn-hire', hCost == null ? 'Workers MAX' : `Hire Worker $${hCost}`, hCost != null && me.gold >= hCost);

    const meta = $('farmers-meta');
    if (meta) {
      meta.textContent = `Workers ${me.workers.length}/${MAX_WORKERS} · Farms ${me.farms.length}/${MAX_FARMS} · Speed ${me.farmSpeed} · Yield ${me.farmYield} (${yieldAmount(me.farmYield)}/harvest) · ${HARVEST_BASE}s base`;
    }
  }

  function setBtn(id, label, enabled) {
    const el = $(id);
    if (!el) return;
    el.textContent = label;
    el.disabled = !enabled;
  }

  function updateEndUi() {
    const panel = $('farmers-end');
    if (!panel || !match || !cfg) return;
    show(panel);
    const title = $('farmers-end-title');
    const desc = $('farmers-end-desc');
    const me = cfg.myPlayerId;
    if (match.endReason === 'draw' || match.winnerSlot == null) {
      if (title) title.textContent = 'Draw';
      if (desc) desc.textContent = 'Same gold when time ran out.';
    } else if (match.winnerSlot === me) {
      if (title) title.textContent = 'You win!';
      if (desc) desc.textContent = match.endReason === 'forfeit'
        ? 'Opponent left the farm.'
        : match.endReason === 'goal'
          ? `Reached $${WIN_GOLD} first.`
          : 'More gold when time expired.';
    } else {
      if (title) title.textContent = 'You lose';
      if (desc) desc.textContent = match.endReason === 'forfeit'
        ? 'You left the match.'
        : 'The other farmer out-earned you.';
    }
  }

  function loop(ts) {
    if (!active) return;
    raf = requestAnimationFrame(loop);
    if (!lastTs) lastTs = ts;
    let dt = (ts - lastTs) / 1000;
    lastTs = ts;
    dt = clamp(dt, 0, 0.05);

    if (match && !ended && cfg?.isHost) {
      match.elapsed += dt;
      tickPlayer(match.players[0], dt);
      tickPlayer(match.players[1], dt);
      checkWin();
      pushSync(false);
    }

    renderCanvas();
    renderHud();
  }

  function bindShop() {
    $('farmers-seed-row')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-seed]');
      if (!btn) return;
      dispatchLocal({ type: 'farmers_buy_seed', seedId: btn.getAttribute('data-seed') });
    });
    $('farmers-btn-speed')?.addEventListener('click', () => dispatchLocal({ type: 'farmers_upgrade_speed' }));
    $('farmers-btn-yield')?.addEventListener('click', () => dispatchLocal({ type: 'farmers_upgrade_yield' }));
    $('farmers-btn-stand')?.addEventListener('click', () => dispatchLocal({ type: 'farmers_upgrade_stand' }));
    $('farmers-btn-hire')?.addEventListener('click', () => dispatchLocal({ type: 'farmers_hire' }));
    $('farmers-forfeit-btn')?.addEventListener('click', () => {
      if (!confirm('Forfeit this Farmers match?')) return;
      window.TDG_PVP?.forfeitMatch?.();
      applyForfeit(cfg?.myPlayerId);
    });
    $('farmers-howto-btn')?.addEventListener('click', () => show($('farmers-howto')));
    $('farmers-howto-close')?.addEventListener('click', () => hide($('farmers-howto')));
    $('farmers-home-btn')?.addEventListener('click', () => {
      cleanup(true);
      window.TDG_PVP?.goHome?.();
    });
  }

  let shopBound = false;

  function start(opts) {
    cleanup(false);
    cfg = {
      myPlayerId: opts.myPlayerId === 1 ? 1 : 0,
      isHost: !!opts.isHost,
      roomId: opts.roomId,
      player0Name: opts.player0Name,
      player1Name: opts.player1Name,
    };
    ended = false;
    active = true;
    lastTs = 0;
    lastSync = 0;

    if (opts.savedState && opts.savedState.mode === 'farmers') {
      match = opts.savedState;
      if (match.winnerSlot != null || match.endReason) ended = true;
    } else {
      match = createMatch(opts);
    }

    hide($('menu-screen'));
    hide($('online-match-screen'));
    hide($('online-queue-screen'));
    hide($('tft-game-screen'));
    show($('farmers-game-screen'));
    hide($('farmers-end'));
    hide($('farmers-howto'));

    canvas = $('farmers-canvas');
    if (canvas) {
      canvas.width = LOGIC_W;
      canvas.height = LOGIC_H;
      ctx = canvas.getContext('2d');
      canvas.onclick = onCanvasClick;
    }

    if (!shopBound) {
      bindShop();
      shopBound = true;
    }

    renderHud();
    renderCanvas();
    raf = requestAnimationFrame(loop);

    if (cfg.isHost) pushSync(true);
  }

  function cleanup(hard) {
    active = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (hard) {
      match = null;
      cfg = null;
      ended = false;
      hide($('farmers-game-screen'));
    }
  }

  function isActive() {
    return active;
  }

  window.FARMERS_ONLINE = {
    start,
    cleanup,
    isActive,
    handleRemote,
    applyAuthState,
    applyForfeit,
  };
})();
