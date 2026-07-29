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
  const COMBAT_INTRO = 0.9;
  const PLAN_TIME_SEC = 50;
  const AUGMENT_TIME_SEC = 25;
  /** Offer an augment pick at the start of these rounds (silver → gold → prismatic). */
  const AUGMENT_ROUNDS = [1, 3, 5];
  const AUGMENT_TIER_BY_ROUND = { 1: 'silver', 3: 'gold', 5: 'prismatic' };
  /** Fixed logical arena so host combat is identical regardless of client canvas size. */
  const LOGIC_W = 800;
  const LOGIC_H = 400;
  const AUTH_SYNC_MS = 100;

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

  /**
   * Augments — pick 1 of 3 on rounds 1 / 3 / 5.
   * instant: one-shot on pick. combat: mutate unit stats at fight spawn.
   * meta flags: boardBonus, traitBonus, incomeFlat, interestBonus, rerollCost, sellMult, playerDmgBonus
   */
  const AUGMENTS = {
    gold_rush: {
      id: 'gold_rush', name: 'Gold Rush', tier: 'silver', icon: '💰',
      desc: 'Gain 10 gold now.',
      instant: (p) => { p.gold += 10; },
    },
    training_weights: {
      id: 'training_weights', name: 'Training Weights', tier: 'silver', icon: '📚',
      desc: 'Gain 6 XP now.',
      instant: (p) => { grantXp(p, 6); },
    },
    iron_scales: {
      id: 'iron_scales', name: 'Iron Scales', tier: 'silver', icon: '🛡️',
      desc: 'Your units gain +15% HP in combat.',
      combat: (st) => { st.hp = Math.round(st.hp * 1.15); },
    },
    sharpened_blades: {
      id: 'sharpened_blades', name: 'Sharpened Blades', tier: 'silver', icon: '🗡️',
      desc: 'Your units gain +12% damage.',
      combat: (st) => { st.damage = Math.round(st.damage * 1.12); },
    },
    scout_contract: {
      id: 'scout_contract', name: 'Scout Contract', tier: 'silver', icon: '🗺️',
      desc: 'Gain a free Knight (2-cost) on your bench.',
      instant: (p) => { grantFreeUnit(p, 'striker'); },
    },
    loaded_dice: {
      id: 'loaded_dice', name: 'Loaded Dice', tier: 'silver', icon: '🎲',
      desc: 'Shop rerolls cost 1 gold instead of 2.',
      rerollCost: 1,
    },
    treasure_trove: {
      id: 'treasure_trove', name: 'Treasure Trove', tier: 'gold', icon: '🪙',
      desc: 'Gain 18 gold now.',
      instant: (p) => { p.gold += 18; },
    },
    battlefield_promotion: {
      id: 'battlefield_promotion', name: 'Battlefield Promotion', tier: 'gold', icon: '⬆️',
      desc: 'Gain 12 XP now.',
      instant: (p) => { grantXp(p, 12); },
    },
    dual_wield: {
      id: 'dual_wield', name: 'Dual Wield', tier: 'gold', icon: '⚔️',
      desc: 'Your units gain +18% attack speed.',
      combat: (st) => { st.attackRate *= 1.18; },
    },
    warrior_heart: {
      id: 'warrior_heart', name: 'Warrior Heart', tier: 'gold', icon: '❤️',
      desc: 'Your Warrior trait counts as +1.',
      traitBonus: { warrior: 1 },
    },
    hunters_mark: {
      id: 'hunters_mark', name: "Hunter's Mark", tier: 'gold', icon: '🎯',
      desc: 'Your Hunter trait counts as +1.',
      traitBonus: { hunter: 1 },
    },
    bestial_fury: {
      id: 'bestial_fury', name: 'Bestial Fury', tier: 'gold', icon: '🐺',
      desc: 'Your Beast trait counts as +1.',
      traitBonus: { beast: 1 },
    },
    high_roller: {
      id: 'high_roller', name: 'High Roller', tier: 'gold', icon: '📈',
      desc: 'Selling units returns 50% more gold.',
      sellMult: 1.5,
    },
    living_legend: {
      id: 'living_legend', name: 'Living Legend', tier: 'prismatic', icon: '✨',
      desc: 'Your units gain +25% HP and +20% damage.',
      combat: (st) => {
        st.hp = Math.round(st.hp * 1.25);
        st.damage = Math.round(st.damage * 1.2);
      },
    },
    dragon_hoard: {
      id: 'dragon_hoard', name: 'Dragon Hoard', tier: 'prismatic', icon: '🐉',
      desc: 'Gain 22 gold and +1 board size.',
      boardBonus: 1,
      instant: (p) => { p.gold += 22; },
    },
    overlord: {
      id: 'overlord', name: 'Overlord', tier: 'prismatic', icon: '👑',
      desc: '+2 maximum board size.',
      boardBonus: 2,
    },
    radiant_arms: {
      id: 'radiant_arms', name: 'Radiant Arms', tier: 'prismatic', icon: '💫',
      desc: 'Your units gain +30% damage.',
      combat: (st) => { st.damage = Math.round(st.damage * 1.3); },
    },
    eternal_guard: {
      id: 'eternal_guard', name: 'Eternal Guard', tier: 'prismatic', icon: '🏰',
      desc: 'Your units gain +35% HP.',
      combat: (st) => { st.hp = Math.round(st.hp * 1.35); },
    },
    executioner: {
      id: 'executioner', name: 'Executioner', tier: 'prismatic', icon: '☠️',
      desc: 'Winning a round deals +4 player damage.',
      playerDmgBonus: 4,
    },
    mystic_bond: {
      id: 'mystic_bond', name: 'Mystic Bond', tier: 'prismatic', icon: '🔮',
      desc: 'Your Mystic trait counts as +1. Units gain +10% HP.',
      traitBonus: { mystic: 1 },
      combat: (st) => { st.hp = Math.round(st.hp * 1.1); },
    },
  };


  const ITEM_BAG = 8;
  const ITEM_SLOTS = 3;
  const ITEM_SHOP = 3;
  const ITEM_COMPONENT_COST = 2;

  const ITEM_COMPONENTS = {
    blade: { id: 'blade', name: 'Blade', icon: '🗡️', kind: 'component', desc: '+12% damage',
      combat: (st) => { st.damage = Math.round(st.damage * 1.12); } },
    vest: { id: 'vest', name: 'Vest', icon: '🦺', kind: 'component', desc: '+15% HP',
      combat: (st) => { st.hp = Math.round(st.hp * 1.15); } },
    bow: { id: 'bow', name: 'Bow', icon: '🏹', kind: 'component', desc: '+12% attack speed',
      combat: (st) => { st.attackRate *= 1.12; } },
    rod: { id: 'rod', name: 'Rod', icon: '🪄', kind: 'component', desc: '+8% damage, +10% range',
      combat: (st) => { st.damage = Math.round(st.damage * 1.08); st.range = Math.round(st.range * 1.1); } },
    cloak: { id: 'cloak', name: 'Cloak', icon: '🧥', kind: 'component', desc: '+12% move speed',
      combat: (st) => { st.speed = Math.round(st.speed * 1.12); } },
    glove: { id: 'glove', name: 'Glove', icon: '🧤', kind: 'component', desc: '+8% AS, +5% damage',
      combat: (st) => { st.attackRate *= 1.08; st.damage = Math.round(st.damage * 1.05); } },
  };

  const ITEM_COMPLETED = {
    infinity_edge: { id: 'infinity_edge', name: 'Infinity Edge', icon: '⚔️', kind: 'completed', desc: '+35% damage',
      combat: (st) => { st.damage = Math.round(st.damage * 1.35); } },
    warmog: { id: 'warmog', name: 'Warmog Plate', icon: '🛡️', kind: 'completed', desc: '+40% HP',
      combat: (st) => { st.hp = Math.round(st.hp * 1.4); } },
    rapid_fire: { id: 'rapid_fire', name: 'Rapid Fire', icon: '💨', kind: 'completed', desc: '+30% attack speed',
      combat: (st) => { st.attackRate *= 1.3; } },
    bloodthirster: { id: 'bloodthirster', name: 'Bloodthirster', icon: '🩸', kind: 'completed', desc: '+22% damage and HP',
      combat: (st) => { st.damage = Math.round(st.damage * 1.22); st.hp = Math.round(st.hp * 1.22); } },
    titans: { id: 'titans', name: "Titan's Resolve", icon: '🪨', kind: 'completed', desc: '+25% HP, +15% damage',
      combat: (st) => { st.hp = Math.round(st.hp * 1.25); st.damage = Math.round(st.damage * 1.15); } },
    guinsoo: { id: 'guinsoo', name: "Guinsoo's Rage", icon: '🌀', kind: 'completed', desc: '+20% damage, +20% AS',
      combat: (st) => { st.damage = Math.round(st.damage * 1.2); st.attackRate *= 1.2; } },
    rabadon: { id: 'rabadon', name: "Rabadon's Hat", icon: '🎩', kind: 'completed', desc: '+28% damage, +20% range',
      combat: (st) => { st.damage = Math.round(st.damage * 1.28); st.range = Math.round(st.range * 1.2); } },
    runaan: { id: 'runaan', name: "Runaan's Hurricane", icon: '🌪️', kind: 'completed', desc: '+25% AS, +15% move',
      combat: (st) => { st.attackRate *= 1.25; st.speed = Math.round(st.speed * 1.15); } },
    gauntlet: { id: 'gauntlet', name: 'Jeweled Gauntlet', icon: '💍', kind: 'completed', desc: '+18% damage, +18% AS, +10% HP',
      combat: (st) => { st.damage = Math.round(st.damage * 1.18); st.attackRate *= 1.18; st.hp = Math.round(st.hp * 1.1); } },
    guardian: { id: 'guardian', name: 'Guardian Angel', icon: '👼', kind: 'completed', desc: '+30% HP, +12% AS',
      combat: (st) => { st.hp = Math.round(st.hp * 1.3); st.attackRate *= 1.12; } },
    shojin: { id: 'shojin', name: 'Spear of Shojin', icon: '🔱', kind: 'completed', desc: '+20% damage, +15% AS, +10% range',
      combat: (st) => { st.damage = Math.round(st.damage * 1.2); st.attackRate *= 1.15; st.range = Math.round(st.range * 1.1); } },
    steadfast: { id: 'steadfast', name: 'Steadfast Heart', icon: '💚', kind: 'completed', desc: '+20% HP, +15% move, +10% damage',
      combat: (st) => { st.hp = Math.round(st.hp * 1.2); st.speed = Math.round(st.speed * 1.15); st.damage = Math.round(st.damage * 1.1); } },
  };

  /** Two components → completed item (order-independent key a+b sorted). */
  const ITEM_RECIPES = {
    'blade+blade': 'infinity_edge',
    'blade+bow': 'guinsoo',
    'blade+cloak': 'bloodthirster',
    'blade+glove': 'gauntlet',
    'blade+rod': 'shojin',
    'blade+vest': 'bloodthirster',
    'bow+bow': 'rapid_fire',
    'bow+cloak': 'runaan',
    'bow+glove': 'gauntlet',
    'bow+rod': 'guinsoo',
    'bow+vest': 'guardian',
    'cloak+cloak': 'steadfast',
    'cloak+glove': 'steadfast',
    'cloak+rod': 'shojin',
    'cloak+vest': 'titans',
    'glove+glove': 'gauntlet',
    'glove+rod': 'gauntlet',
    'glove+vest': 'guardian',
    'rod+rod': 'rabadon',
    'rod+vest': 'titans',
    'vest+vest': 'warmog',
  };

  const ITEMS = { ...ITEM_COMPONENTS, ...ITEM_COMPLETED };
  const COMPONENT_IDS = Object.keys(ITEM_COMPONENTS);

  function itemDef(id) { return ITEMS[id] || null; }

  function recipeKey(a, b) {
    return [a, b].slice().sort().join('+');
  }

  function combineItems(a, b) {
    const id = ITEM_RECIPES[recipeKey(a, b)];
    return id || null;
  }

  function applyItemsToCombatStats(st, itemIds) {
    const out = { ...st };
    for (const id of itemIds || []) {
      const def = itemDef(id);
      if (def?.combat) def.combat(out);
    }
    return out;
  }

  function emptyItemBagSlot(p) {
    if (!Array.isArray(p.itemBag)) p.itemBag = Array(ITEM_BAG).fill(null);
    return p.itemBag.findIndex((x) => !x);
  }

  function rollItemShop(p) {
    const seed = hashSeed(`${match.roomId}|items|${state.round}|p${p.id}|${p.itemShopGen || 0}`);
    const rng = mulberry32(seed ^ ((p.level || 1) * 4243));
    p.itemShopGen = (p.itemShopGen || 0) + 1;
    const shop = [];
    for (let i = 0; i < ITEM_SHOP; i++) {
      shop.push(COMPONENT_IDS[Math.floor(rng() * COMPONENT_IDS.length)]);
    }
    p.itemShop = shop;
  }

  function grantItemToBag(p, itemId) {
    const slot = emptyItemBagSlot(p);
    if (slot < 0) return false;
    p.itemBag[slot] = itemId;
    return true;
  }


  function returnUnitItemsToBag(p, unit) {
    if (!unit?.items?.length) return;
    const leftover = [];
    for (const id of unit.items) {
      if (!grantItemToBag(p, id)) leftover.push(id);
    }
    unit.items = [];
    for (const id of leftover) {
      const def = itemDef(id);
      p.gold += def?.kind === 'completed' ? 3 : 1;
    }
  }

  function tryBuyItem(shopIdx) {
    const p = me();
    if (state.phase !== 'planning' || p.ready) return false;
    const id = p.itemShop?.[shopIdx];
    if (!id) return false;
    if (p.gold < ITEM_COMPONENT_COST) {
      pushMsg(`Need ${ITEM_COMPONENT_COST}g for an item.`);
      return false;
    }
    if (emptyItemBagSlot(p) < 0) {
      pushMsg('Item bag full — equip or sell an item.');
      return false;
    }
    p.gold -= ITEM_COMPONENT_COST;
    grantItemToBag(p, id);
    p.itemShop[shopIdx] = null;
    sfx('buy');
    syncArmy(p);
    renderHud();
    flashGold();
    return true;
  }

  function trySellItem(bagIdx) {
    const p = me();
    if (state.phase !== 'planning' || p.ready) return false;
    const id = p.itemBag?.[bagIdx];
    if (!id) return false;
    const def = itemDef(id);
    p.itemBag[bagIdx] = null;
    p.gold += def?.kind === 'completed' ? 3 : 1;
    pushMsg(`Sold ${def?.name || 'item'}`);
    sfx('sell');
    syncArmy(p);
    renderHud();
    flashGold();
    return true;
  }

  function tryEquipItem(bagIdx, unitRef) {
    const p = me();
    if (state.phase !== 'planning' || p.ready) return false;
    const itemId = p.itemBag?.[bagIdx];
    const unit = getUnitAt(p, unitRef);
    if (!itemId || !unit) return false;
    if (!Array.isArray(unit.items)) unit.items = [];

    // Try combine with an existing component on the unit.
    if (ITEM_COMPONENTS[itemId]) {
      for (let i = 0; i < unit.items.length; i++) {
        const other = unit.items[i];
        if (!ITEM_COMPONENTS[other]) continue;
        const made = combineItems(itemId, other);
        if (made) {
          unit.items[i] = made;
          p.itemBag[bagIdx] = null;
          pushMsg(`${baseStats(unit.type).name} forged ${itemDef(made).name}!`);
          sfx('merge');
          syncArmy(p);
          renderHud();
          return true;
        }
      }
    }

    if (unit.items.length >= ITEM_SLOTS) {
      pushMsg('That unit already holds 3 items.');
      return false;
    }
    unit.items.push(itemId);
    p.itemBag[bagIdx] = null;
    pushMsg(`Equipped ${itemDef(itemId)?.name || 'item'} on ${baseStats(unit.type).name}`);
    sfx('buy');
    syncArmy(p);
    renderHud();
    return true;
  }

  function tryUnequipItem(unitRef, itemIndex) {
    const p = me();
    if (state.phase !== 'planning' || p.ready) return false;
    const unit = getUnitAt(p, unitRef);
    if (!unit?.items?.[itemIndex]) return false;
    const slot = emptyItemBagSlot(p);
    if (slot < 0) {
      pushMsg('Item bag full.');
      return false;
    }
    p.itemBag[slot] = unit.items[itemIndex];
    unit.items.splice(itemIndex, 1);
    syncArmy(p);
    renderHud();
    return true;
  }


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
  let lastAuthPublishAt = 0;
  let authSyncAcc = 0;
  let waitElapsed = 0;
  let gotAuthSnapshot = false;
  let cpuThinkAcc = 0;
  let cpuRerollsThisRound = 0;
  let cpuXpBuysThisRound = 0;
  let cpuActionsThisRound = 0;
  let audioCtx = null;
  let mergeBurstUntil = 0;

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

  function playTone(freq, dur = 0.08, type = 'triangle', gain = 0.04) {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const t0 = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      g.gain.setValueAtTime(gain, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      osc.connect(g);
      g.connect(audioCtx.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    } catch { /* audio optional */ }
  }

  function sfx(kind) {
    if (kind === 'buy') playTone(520, 0.07, 'sine', 0.035);
    else if (kind === 'sell') playTone(220, 0.09, 'triangle', 0.04);
    else if (kind === 'merge') { playTone(440, 0.06); setTimeout(() => playTone(660, 0.1, 'sine', 0.05), 60); }
    else if (kind === 'ready') playTone(380, 0.1, 'square', 0.03);
    else if (kind === 'hit') playTone(180, 0.045, 'sawtooth', 0.025);
    else if (kind === 'ko') playTone(140, 0.16, 'triangle', 0.05);
    else if (kind === 'fight') playTone(300, 0.12, 'square', 0.035);
  }

  function uid() {
    return `u${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  }

  function makeUnit(type, star = 1, items = []) {
    return { type, star: Math.min(MAX_STAR, Math.max(1, star | 0)), id: uid(), items: Array.isArray(items) ? items.slice(0, ITEM_SLOTS) : [] };
  }

  function unitCost(type) { return UNIT_COST[type] || 2; }

  function sellValue(unit, owner) {
    const base = unitCost(unit.type) * (STAR_SELL[unit.star] || 1);
    const mult = owner ? sellMultFor(owner) : 1;
    return Math.max(1, Math.floor(base * mult));
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
      shop: Array(SHOP).fill(null),
      bench: Array(BENCH).fill(null),
      board: Array.from({ length: ROWS }, () => Array(COLS).fill(null)),
      ready: false,
      traits: {},
      augments: [],
      augmentChoices: null,
      itemBag: Array(ITEM_BAG).fill(null),
      itemShop: Array(ITEM_SHOP).fill(null),
      itemShopGen: 0,
    };
  }

  function playerCount() { return state?.players?.length || 2; }

  function me() { return state.players[match.playerId]; }

  function myPairing() {
    const pairs = state?.pairings || [];
    return pairs.find((pr) => pr[0] === match.playerId || pr[1] === match.playerId) || null;
  }

  function opp() {
    const pair = myPairing();
    if (pair) {
      const oid = pair[0] === match.playerId ? pair[1] : pair[0];
      return state.players[oid] || null;
    }
    if (playerCount() === 2) return state.players[1 - match.playerId] || null;
    return null;
  }

  function alivePlayers() {
    return (state?.players || []).filter((p) => p && Number(p.hp) > 0);
  }

  function buildPairings(seedExtra = 0) {
    const ids = alivePlayers().map((p) => p.id);
    const seed = hashSeed(`${match.roomId}|pair|${state.round}|${seedExtra}`);
    const rng = mulberry32(seed);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    const pairs = [];
    let bye = null;
    for (let i = 0; i < ids.length; i += 2) {
      if (i + 1 >= ids.length) bye = ids[i];
      else pairs.push([ids[i], ids[i + 1]]);
    }
    return { pairs, bye };
  }

  function fightLabel(leftPid, rightPid) {
    const a = state.players[leftPid]?.name || `P${leftPid}`;
    const b = state.players[rightPid]?.name || `P${rightPid}`;
    return `${a} vs ${b}`;
  }

  function boardCap(p) {
    const bonus = sumAugmentMeta(p, 'boardBonus');
    return Math.min(MAX_LEVEL + 2, Math.max(1, p.level) + bonus);
  }

  function hasAugment(p, id) {
    return !!(p?.augments && p.augments.includes(id));
  }

  function playerAugments(p) {
    return (p?.augments || []).map((id) => AUGMENTS[id]).filter(Boolean);
  }

  function sumAugmentMeta(p, key) {
    let n = 0;
    for (const a of playerAugments(p)) {
      if (typeof a[key] === 'number') n += a[key];
    }
    return n;
  }

  function rerollCostFor(p) {
    let cost = REROLL;
    for (const a of playerAugments(p)) {
      if (a.rerollCost != null) cost = Math.min(cost, a.rerollCost);
    }
    return cost;
  }

  function sellMultFor(p) {
    let m = 1;
    for (const a of playerAugments(p)) {
      if (a.sellMult) m = Math.max(m, a.sellMult);
    }
    return m;
  }

  function grantXp(p, amount) {
    p.xp += amount;
    while (p.level < MAX_LEVEL && p.xp >= (LEVEL_XP[p.level] || 999)) {
      p.xp -= LEVEL_XP[p.level] || 0;
      p.level += 1;
    }
  }

  function grantFreeUnit(p, type) {
    const slot = emptyBenchSlot(p);
    if (slot < 0) {
      p.gold += unitCost(type);
      return;
    }
    p.bench[slot] = makeUnit(type, 1);
    tryAutoMerge(p, false);
  }

  function applyAugmentsToCombatStats(st, p) {
    const out = { ...st };
    for (const a of playerAugments(p)) {
      if (typeof a.combat === 'function') a.combat(out);
    }
    return out;
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
    if (match?.vsCpu) return;
    window.TDG_PVP?.sendAction?.(action);
  }

  function isAuthority() {
    return !!(match && match.isHost);
  }

  function isVsCpu() {
    return !!(match && match.vsCpu);
  }

  function cpuPlayer() {
    return state?.players?.[1] || null;
  }

  function serializeUnit(u) {
    return u ? { type: u.type, star: u.star, id: u.id, items: Array.isArray(u.items) ? u.items.slice(0, ITEM_SLOTS) : [] } : null;
  }

  function serializeArmy(p) {
    return {
      bench: p.bench.map((u) => serializeUnit(u)),
      board: p.board.map((row) => row.map((u) => serializeUnit(u))),
      gold: p.gold,
      level: p.level,
      xp: p.xp,
      shop: p.shop.slice(),
      shopGen: p.shopGen || 0,
      ready: !!p.ready,
      winStreak: p.winStreak || 0,
      lossStreak: p.lossStreak || 0,
      hp: p.hp,
      name: p.name,
      augments: Array.isArray(p.augments) ? p.augments.slice() : [],
      augmentChoices: Array.isArray(p.augmentChoices) ? p.augmentChoices.slice() : null,
      itemBag: Array.isArray(p.itemBag) ? p.itemBag.slice() : Array(ITEM_BAG).fill(null),
      itemShop: Array.isArray(p.itemShop) ? p.itemShop.slice() : Array(ITEM_SHOP).fill(null),
      itemShopGen: p.itemShopGen || 0,
    };
  }

  function applyArmySnapshot(p, snap) {
    if (!snap) return;
    const readUnit = (u) => (u ? {
      type: u.type,
      star: u.star || 1,
      id: u.id || uid(),
      items: Array.isArray(u.items) ? u.items.filter((id) => !!itemDef(id)).slice(0, ITEM_SLOTS) : [],
    } : null);
    if (snap.bench) {
      p.bench = snap.bench.map((u) => readUnit(u));
    }
    if (snap.board) {
      p.board = snap.board.map((row) => row.map((u) => readUnit(u)));
    }
    if (snap.gold != null && Number.isFinite(Number(snap.gold))) p.gold = Number(snap.gold);
    if (snap.level != null) p.level = snap.level;
    if (snap.xp != null) p.xp = snap.xp;
    if (Array.isArray(snap.shop)) p.shop = snap.shop.slice();
    if (snap.shopGen != null) p.shopGen = snap.shopGen;
    if (snap.ready != null) p.ready = !!snap.ready;
    if (snap.winStreak != null) p.winStreak = snap.winStreak;
    if (snap.lossStreak != null) p.lossStreak = snap.lossStreak;
    if (snap.hp != null) p.hp = snap.hp;
    if (snap.name) p.name = snap.name;
    if (Array.isArray(snap.augments)) p.augments = snap.augments.slice();
    if (snap.augmentChoices === null) p.augmentChoices = null;
    else if (Array.isArray(snap.augmentChoices)) p.augmentChoices = snap.augmentChoices.slice();
    if (Array.isArray(snap.itemBag)) p.itemBag = snap.itemBag.slice(0, ITEM_BAG);
    else if (!Array.isArray(p.itemBag)) p.itemBag = Array(ITEM_BAG).fill(null);
    if (Array.isArray(snap.itemShop)) p.itemShop = snap.itemShop.slice(0, ITEM_SHOP);
    else if (!Array.isArray(p.itemShop)) p.itemShop = Array(ITEM_SHOP).fill(null);
    if (snap.itemShopGen != null) p.itemShopGen = snap.itemShopGen;
  }

  function serializeCombatLight() {
    return (state.combatUnits || []).map((u) => ({
      uid: u.uid,
      owner: u.owner,
      type: u.type,
      star: u.star,
      name: u.name,
      role: u.role,
      hp: Math.round(u.hp),
      maxHp: u.maxHp,
      x: Math.round(u.x * 10) / 10,
      y: Math.round(u.y * 10) / 10,
      facing: Math.round((u.facing || 0) * 100) / 100,
      alive: !!u.alive,
      deathT: u.deathT || 0,
      size: u.size,
      color: u.color,
      attackPhase: u.attackPhase || 'idle',
      attackProgress: u.attackProgress || 0,
      moveSpeed: u.moveSpeed || 0,
      animT: u.animT || 0,
      hitFlash: u.hitFlash || 0,
      damage: u.damage,
      attackRate: u.attackRate,
      range: u.range,
      speed: u.speed,
    }));
  }

  function serializeMatchState() {
    return {
      mode: 'tft',
      phase: state.phase,
      round: state.round,
      planTimeLeft: state.planTimeLeft ?? PLAN_TIME_SEC,
      augmentTimeLeft: state.augmentTimeLeft ?? 0,
      combatSeed: state.combatSeed || 0,
      combatElapsed: state.combatElapsed || 0,
      combatIntro: state.combatIntro || 0,
      combatFinished: !!state.combatFinished,
      resultApplied: !!state.resultApplied,
      resultTimer: state.resultTimer || 0,
      pendingResult: state.pendingResult || null,
      lastCombat: state.lastCombat || null,
      pairings: Array.isArray(state.pairings) ? state.pairings.map((pr) => pr.slice()) : [],
      byePid: state.byePid ?? null,
      fightSides: Array.isArray(state.fightSides) ? state.fightSides.slice() : null,
      roundResults: Array.isArray(state.roundResults) ? state.roundResults.slice() : [],
      players: state.players.map((p) => serializeArmy(p)),
      combatUnits: (state.phase === 'combat' || state.phase === 'result' || state.phase === 'gameover')
        ? serializeCombatLight()
        : [],
      projectiles: (state.projectiles || []).map((p) => ({
        x: p.x, y: p.y, tx: p.tx, ty: p.ty, to: p.to,
        damage: p.damage, color: p.color, life: p.life, maxLife: p.maxLife,
      })),
      messages: (state.messages || []).slice(0, 8),
    };
  }

  function publishAuthState(force = false) {
    if (!active || !state || !isAuthority() || isVsCpu()) return;
    const now = performance.now();
    if (!force && now - lastAuthPublishAt < AUTH_SYNC_MS) return;
    lastAuthPublishAt = now;
    window.TDG_PVP?.sendState?.(serializeMatchState());
  }

  function shopHasCards(p) {
    return Array.isArray(p?.shop) && p.shop.some((t) => !!t);
  }

  function requestHostSync() {
    if (!active || isAuthority()) return;
    broadcastAction({ type: 'tft_request_sync', playerId: match.playerId });
  }

  function publishPlanningSnapshot() {
    if (!isAuthority()) return;
    publishAuthState(true);
    // Guest may join a beat late — republish so shop cards always land.
    [250, 700, 1600].forEach((ms) => {
      setTimeout(() => {
        if (active && isAuthority() && state?.phase === 'planning') publishAuthState(true);
      }, ms);
    });
  }

  function ensureLocalShopVisible() {
    const p = me();
    if (!p || state.phase !== 'planning' || p.ready) return;
    if (!Array.isArray(p.shop) || p.shop.length !== SHOP) {
      p.shop = Array(SHOP).fill(null);
    }
    // Only invent a temporary shop before the first host snapshot.
    // Never grant free gold or free rerolls after the match is synced.
    if (!gotAuthSnapshot && !shopHasCards(p)) {
      rollShop(p);
      renderHud();
    }
  }

  function applyCombatUnitsFromAuth(list) {
    if (!Array.isArray(list)) return;
    const prev = new Map((state.combatUnits || []).map((u) => [u.uid, u]));
    state.combatUnits = list.map((u) => {
      const old = prev.get(u.uid);
      const hit = old && Number.isFinite(old.hp) && u.hp < old.hp - 0.4;
      if (hit && isAuthority() === false) {
        addFloat(old.x, old.y - (old.size || 20), `-${Math.round(old.hp - u.hp)}`, '#ffb4a2');
        if (u.alive === false && old.alive) addFloat(old.x, old.y - 10, 'KO', '#f0d878');
      }
      return {
        uid: u.uid,
        owner: u.owner,
        type: u.type,
        star: u.star || 1,
        name: u.name || u.type,
        role: u.role || 'melee',
        hp: u.hp,
        maxHp: u.maxHp || u.hp,
        x: old?.x ?? u.x,
        y: old?.y ?? u.y,
        _tx: u.x,
        _ty: u.y,
        facing: old?.facing ?? u.facing ?? 0,
        _tfacing: u.facing || 0,
        alive: u.alive !== false,
        deathT: u.alive === false ? Math.max(old?.deathT || 0, u.deathT || 0) : 0,
        size: u.size || 20,
        color: u.color || '#94a3b8',
        attackPhase: u.attackPhase || 'idle',
        attackProgress: u.attackProgress || 0,
        moveSpeed: u.moveSpeed || 0,
        animT: old?.animT ?? u.animT ?? 0,
        hitFlash: hit ? 1 : Math.max(0, old?.hitFlash || 0),
        attackFlash: Math.max(0, old?.attackFlash || 0, u.attackFlash || 0),
        attackCd: 0,
        damage: u.damage || 20,
        attackRate: u.attackRate || 0.8,
        range: u.range || 40,
        speed: u.speed || 50,
        targetUid: null,
        pendingHit: null,
      };
    });
  }

  /**
   * Guest applies host match state — single source of truth for combat, HP, and round flow.
   */
  function applyAuthState(snap) {
    if (!active || !state || !snap || snap.mode !== 'tft') return false;
    if (isAuthority()) return false;

    const prevPhase = state.phase;
    const prevRound = state.round;
    const phaseChange = prevPhase !== snap.phase || prevRound !== snap.round || !gotAuthSnapshot;
    gotAuthSnapshot = true;

    state.round = snap.round ?? state.round;
    if (snap.planTimeLeft != null) state.planTimeLeft = Math.max(0, snap.planTimeLeft);
    if (snap.augmentTimeLeft != null) state.augmentTimeLeft = Math.max(0, snap.augmentTimeLeft);
    state.combatSeed = snap.combatSeed || state.combatSeed;
    state.combatElapsed = snap.combatElapsed || 0;
    state.combatIntro = snap.combatIntro || 0;
    state.combatFinished = !!snap.combatFinished;
    state.resultApplied = !!snap.resultApplied;
    state.resultTimer = snap.resultTimer ?? state.resultTimer;
    state.pendingResult = snap.pendingResult || null;
    state.lastCombat = snap.lastCombat || state.lastCombat;
    if (Array.isArray(snap.messages)) {
      state.messages = snap.messages.slice();
      const el = $('tft-log');
      if (el) el.innerHTML = state.messages.map((m) => `<div class="tft-log-line">${escapeHtml(m)}</div>`).join('');
    }

    if (Array.isArray(snap.pairings)) state.pairings = snap.pairings.map((pr) => pr.slice());
    if (snap.byePid != null) state.byePid = snap.byePid;
    if (Array.isArray(snap.fightSides)) state.fightSides = snap.fightSides.slice();
    if (Array.isArray(snap.roundResults)) state.roundResults = snap.roundResults.slice();

    if (Array.isArray(snap.players)) {
      // Grow local roster if host has more players.
      while (state.players.length < snap.players.length) {
        const i = state.players.length;
        const name = snap.players[i]?.name || `Player ${i + 1}`;
        state.players.push(freshPlayer(i, name));
      }
      for (let i = 0; i < snap.players.length; i++) {
        const sp = snap.players[i];
        const lp = state.players[i];
        if (!sp || !lp) continue;
        // Always take host HP / streaks / ready.
        if (sp.hp != null) lp.hp = sp.hp;
        if (sp.name) lp.name = sp.name;
        lp.ready = !!sp.ready;
        lp.winStreak = sp.winStreak || 0;
        lp.lossStreak = sp.lossStreak || 0;

        const takeArmy = i !== match.playerId || phaseChange || snap.phase !== 'planning';
        if (takeArmy) {
          applyArmySnapshot(lp, sp);
        } else if (!shopHasCards(lp) && shopHasCards(sp)) {
          lp.shop = sp.shop.slice();
          if (sp.shopGen != null) lp.shopGen = sp.shopGen;
        }
      }
    }

    const multiLocalFight = playerCount() > 2 && !!myPairing();
    if (Array.isArray(snap.combatUnits) && (snap.phase === 'combat' || snap.phase === 'result' || snap.phase === 'gameover')) {
      // In 3–4 player lobbies, each client simulates its own pairing visually.
      if (!(multiLocalFight && snap.phase === 'combat' && !snap.combatFinished)) {
        applyCombatUnitsFromAuth(snap.combatUnits);
      }
    } else if (snap.phase === 'planning') {
      state.combatUnits = [];
      state.projectiles = [];
    }
    if (Array.isArray(snap.projectiles)) state.projectiles = snap.projectiles.slice();

    state.phase = snap.phase || state.phase;
    if (phaseChange || prevPhase !== state.phase) {
      setShellMode(state.phase === 'gameover' ? 'gameover' : state.phase);
      endDrag(true);
      if (state.phase === 'combat') resizeCanvas();
    }

    renderHud();
    if (state.phase === 'combat' || state.phase === 'result' || state.phase === 'gameover') {
      drawCombat();
    } else if (state.phase === 'planning' || state.phase === 'augment') {
      drawPlanningPreview();
    }
    return true;
  }

  function syncArmy(p) {
    broadcastAction({
      type: 'tft_army_sync',
      playerId: p.id,
      army: serializeArmy(p),
    });
    // Host keeps a live mirror for guests after local edits.
    if (isAuthority()) publishAuthState(true);
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
          const mergedItems = [];
          for (const slot of take) {
            for (const id of (slot.unit.items || [])) {
              if (mergedItems.length < ITEM_SLOTS) mergedItems.push(id);
            }
          }
          const upgraded = makeUnit(type, star + 1, mergedItems);
          if (boardKeep.area === 'bench') p.bench[boardKeep.idx] = upgraded;
          else p.board[boardKeep.r][boardKeep.c] = upgraded;

          if (announce) {
            const name = baseStats(type).name;
            pushMsg(`${p.name}: ${name} → ${starLabel(star + 1)}!`);
            sfx('merge');
            mergeBurstUntil = performance.now() + 700;
            if (p.id === match.playerId) {
              selected = boardKeep.area === 'board'
                ? { area: 'board', r: boardKeep.r, c: boardKeep.c }
                : { area: 'bench', idx: boardKeep.idx };
            }
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
    base += sumAugmentMeta(p, 'incomeFlat');
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
    for (const a of playerAugments(p)) {
      if (!a.traitBonus) continue;
      for (const [tid, n] of Object.entries(a.traitBonus)) {
        counts[tid] = (counts[tid] || 0) + n;
      }
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
    const w = LOGIC_W;
    const h = LOGIC_H;
    const padX = Math.max(40, w * 0.05);
    const padY = Math.max(50, h * 0.14);
    const midGap = Math.max(48, w * 0.08);
    const mid = w / 2;
    const halfW = mid - padX - midGap / 2;
    const cellW = halfW / COLS;
    const cellH = (h - padY * 2) / ROWS;
    return { w, h, padX, padY, mid, midGap, halfW, cellW, cellH };
  }

  function beginLogicDraw() {
    if (!ctx || !canvas) return null;
    resizeCanvas();
    const sx = canvas.width / LOGIC_W;
    const sy = canvas.height / LOGIC_H;
    ctx.setTransform(sx, 0, 0, sy, 0, 0);
    return arenaLayout();
  }

  function endLogicDraw() {
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
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

  function spawnCombatUnits(leftPid = null, rightPid = null) {
    const layout = arenaLayout();
    const units = [];
    const sides = [
      leftPid != null ? leftPid : (state.fightSides?.[0] ?? 0),
      rightPid != null ? rightPid : (state.fightSides?.[1] ?? 1),
    ];
    state.fightSides = sides.slice();
    const traits = [traitCounts(state.players[sides[0]]), traitCounts(state.players[sides[1]])];

    for (let side = 0; side < 2; side++) {
      const pid = sides[side];
      const p = state.players[pid];
      if (!p) continue;
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const cell = p.board[r][c];
          if (!cell) continue;
          const st0 = scaledStats(cell.type, cell.star || 1);
          const st1 = applyTraitsToStats(st0, traits[side]);
          const st2 = applyAugmentsToCombatStats(st1, p);
          const st = applyItemsToCombatStats(st2, cell.items || []);
          const pos = boardCellPos(side, r, c, layout);
          units.push({
            uid: cell.id || `${pid}-${r}-${c}`,
            owner: side,
            sourcePid: pid,
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
            facing: side === 0 ? 0 : Math.PI,
            attackCd: 0.1 + ((hashSeed(String(cell.id || `${pid}-${r}-${c}`)) % 100) / 100) * 0.35,
            attackFlash: 0,
            hitFlash: 0,
            attackPhase: 'idle',
            attackProgress: 0,
            moveSpeed: 0,
            pendingHit: null,
            targetUid: null,
            alive: true,
            deathT: 0,
            animT: (hashSeed(String(cell.id || `${cell.type}-${pid}-${r}-${c}`)) % 1000) / 100,
          });
        }
      }
    }
    state.combatUnits = units;
    state.projectiles = [];
    state.floatTexts = [];
    state.combatElapsed = 0;
    state.combatIntro = COMBAT_INTRO;
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

  function computeResultFromField(units = state.combatUnits, sides = state.fightSides, seed = state.combatSeed) {
    const rem0 = units.filter((u) => u.alive && u.owner === 0);
    const rem1 = units.filter((u) => u.alive && u.owner === 1);
    const leftPid = sides?.[0] ?? 0;
    const rightPid = sides?.[1] ?? 1;
    const rng = mulberry32((seed || 1) ^ 0xC0FFEE ^ ((leftPid + 1) * 97) ^ ((rightPid + 1) * 193));
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
    const winnerPid = winner === 0 ? leftPid : rightPid;
    let damage = Math.max(4, Math.min(20, survivors.length * 2 + starBonus + Math.ceil(state.round * 0.7)));
    damage += sumAugmentMeta(state.players[winnerPid], 'playerDmgBonus');
    damage = Math.min(28, damage);
    return {
      winner,
      damage,
      rem0: rem0.length,
      rem1: rem1.length,
      leftPid,
      rightPid,
      winnerPid,
      loserPid: winner === 0 ? rightPid : leftPid,
    };
  }

  /** Estimate board power for off-screen pairings (deterministic). */
  function boardFightPower(pid) {
    const p = state.players[pid];
    if (!p) return 0;
    const traits = traitCounts(p);
    let score = 0.01;
    let units = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = p.board[r][c];
        if (!cell) continue;
        units += 1;
        const st0 = scaledStats(cell.type, cell.star || 1);
        const st1 = applyTraitsToStats(st0, traits);
        const st2 = applyAugmentsToCombatStats(st1, p);
        const st = applyItemsToCombatStats(st2, cell.items || []);
        score += st.hp * 0.035 + st.damage * Math.max(0.35, st.attackRate) * 1.15 + (cell.star || 1) * 4;
      }
    }
    return score * (1 + Math.min(6, units) * 0.03);
  }

  function simulatePairingResult(leftPid, rightPid, seed) {
    const rng = mulberry32((seed || 1) ^ ((leftPid + 1) * 131) ^ ((rightPid + 1) * 733) ^ (state.round * 17));
    const p0 = boardFightPower(leftPid);
    const p1 = boardFightPower(rightPid);
    let winner = 0;
    if (Math.abs(p0 - p1) < 0.75) winner = rng() < 0.5 ? 0 : 1;
    else winner = p0 > p1 ? 0 : 1;
    const winPower = winner === 0 ? p0 : p1;
    const losePower = winner === 0 ? p1 : p0;
    const ratio = winPower / Math.max(1, losePower);
    let damage = Math.max(4, Math.min(20, Math.round(5 + ratio * 3 + state.round * 0.7)));
    const winnerPid = winner === 0 ? leftPid : rightPid;
    damage += sumAugmentMeta(state.players[winnerPid], 'playerDmgBonus');
    damage = Math.min(28, damage);
    return {
      winner,
      damage,
      rem0: winner === 0 ? 3 : 1,
      rem1: winner === 1 ? 3 : 1,
      leftPid,
      rightPid,
      winnerPid,
      loserPid: winner === 0 ? rightPid : leftPid,
    };
  }

  function tickCombat(dt) {
    if (state.phase !== 'combat' || state.combatFinished) return;
    const step = dt * COMBAT_SPEED;
    state.combatElapsed += step;
    const layout = arenaLayout();

    if ((state.combatIntro || 0) > 0) {
      state.combatIntro = Math.max(0, state.combatIntro - step);
      for (const u of state.combatUnits) {
        u.animT += step;
        u.moveSpeed = 0;
      }
      return;
    }

    // Soft separation so units don't fully stack.
    for (let i = 0; i < state.combatUnits.length; i++) {
      const a = state.combatUnits[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < state.combatUnits.length; j++) {
        const b = state.combatUnits[j];
        if (!b.alive || a.owner !== b.owner) continue;
        const d = dist(a, b);
        const minD = (a.size + b.size) * 0.55;
        if (d > 0.1 && d < minD) {
          const push = (minD - d) * 0.35;
          const nx = (a.x - b.x) / d;
          const ny = (a.y - b.y) / d;
          a.x += nx * push * 0.5;
          a.y += ny * push * 0.5;
          b.x -= nx * push * 0.5;
          b.y -= ny * push * 0.5;
        }
      }
    }

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
        u.attackProgress = Math.min(1, u.attackProgress + step * 3.4);
        if (u.pendingHit && !u.pendingHit.done && u.attackProgress >= 0.5) {
          u.pendingHit.done = true;
          const target = findUnit(u.pendingHit.target);
          if (target?.alive) {
            target.hp -= u.pendingHit.damage;
            target.hitFlash = 1;
            addFloat(target.x, target.y - target.size, `-${u.pendingHit.damage}`, '#ffb4a2');
            sfx('hit');
            if (target.hp <= 0) {
              target.alive = false;
              target.deathT = 0;
              addFloat(target.x, target.y - 10, 'KO', '#f0d878');
              sfx('ko');
            }
          }
        }
        if (u.attackProgress >= 1) {
          u.attackPhase = 'idle';
          u.attackProgress = 0;
          u.pendingHit = null;
        }
      }

      const foes = state.combatUnits.filter((x) => x.alive && x.owner !== u.owner);
      if (!foes.length) {
        u.moveSpeed = 0;
        continue;
      }

      // Prefer nearer foes, slight bias to lower HP%.
      let best = foes[0];
      let bestScore = Infinity;
      for (const f of foes) {
        const d = dist(u, f);
        const hurt = 1 - Math.max(0, f.hp / Math.max(1, f.maxHp));
        const score = d - hurt * 28;
        if (score < bestScore) { best = f; bestScore = score; }
      }
      const bestD = dist(u, best);
      u.targetUid = best.uid;
      u.facing = Math.atan2(best.y - u.y, best.x - u.x);

      const stopRange = Math.max(28, u.range * 0.88);
      if (bestD <= stopRange) {
        u.moveSpeed = 0;
        if (u.attackCd <= 0 && u.attackPhase === 'idle') {
          u.attackCd = 1 / Math.max(0.28, u.attackRate);
          u.attackFlash = 1;
          u.attackPhase = 'strike';
          u.attackProgress = 0;
          const ranged = u.range >= 90;
          if (ranged) {
            u.pendingHit = null;
            state.projectiles.push({
              x: u.x,
              y: u.y - 10,
              tx: best.x,
              ty: best.y - 6,
              to: best.uid,
              damage: u.damage,
              color: u.color,
              life: 0.28,
              maxLife: 0.28,
            });
          } else {
            u.pendingHit = { target: best.uid, damage: u.damage, done: false };
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
        u.x = Math.max(24, Math.min(layout.w - 24, u.x));
        u.y = Math.max(36, Math.min(layout.h - 24, u.y));
      }
    }

    for (let i = state.projectiles.length - 1; i >= 0; i--) {
      const p = state.projectiles[i];
      p.life -= step;
      const t = 1 - Math.max(0, p.life) / p.maxLife;
      p.x += (p.tx - p.x) * Math.min(1, step * 10);
      p.y += (p.ty - p.y) * Math.min(1, step * 10);
      if (t >= 0.9 || p.life <= 0) {
        const target = findUnit(p.to);
        if (target?.alive) {
          target.hp -= p.damage;
          target.hitFlash = 1;
          addFloat(target.x, target.y - target.size, `-${p.damage}`, '#7dd3fc');
          sfx('hit');
          if (target.hp <= 0) {
            target.alive = false;
            target.deathT = 0;
            addFloat(target.x, target.y - 10, 'KO', '#f0d878');
            sfx('ko');
          }
        }
        state.projectiles.splice(i, 1);
      }
    }

    for (let i = state.floatTexts.length - 1; i >= 0; i--) {
      const f = state.floatTexts[i];
      f.life -= step;
      f.y -= 36 * step;
      if (f.life <= 0) state.floatTexts.splice(i, 1);
    }

    const alive0 = state.combatUnits.some((u) => u.alive && u.owner === 0);
    const alive1 = state.combatUnits.some((u) => u.alive && u.owner === 1);
    if ((!alive0 || !alive1 || state.combatElapsed >= COMBAT_MAX_SEC) && state.combatElapsed > COMBAT_INTRO + 0.15) {
      finishLiveCombat();
    }
  }

  function tickGuestCombatVisual(dt) {
    const step = dt * COMBAT_SPEED;
    state.combatElapsed = (state.combatElapsed || 0) + step;
    for (const u of state.combatUnits || []) {
      u.animT = (u.animT || 0) + step;
      if (u._tx != null) {
        const k = Math.min(1, step * 14);
        u.x += (u._tx - u.x) * k;
        u.y += (u._ty - u.y) * k;
      }
      if (u._tfacing != null) u.facing = u._tfacing;
      u.hitFlash = Math.max(0, (u.hitFlash || 0) - step * 5);
      u.attackFlash = Math.max(0, (u.attackFlash || 0) - step * 3.5);
      if (!u.alive) u.deathT = Math.min(1, (u.deathT || 0) + step * 1.5);
      else u.deathT = 0;
    }
    for (const p of state.projectiles || []) {
      p.x += ((p.tx ?? p.x) - p.x) * Math.min(1, step * 10);
      p.y += ((p.ty ?? p.y) - p.y) * Math.min(1, step * 10);
    }
    for (let i = (state.floatTexts || []).length - 1; i >= 0; i--) {
      const f = state.floatTexts[i];
      f.life -= step;
      f.y -= 36 * step;
      if (f.life <= 0) state.floatTexts.splice(i, 1);
    }
  }

  function finishLiveCombat() {
    if (state.combatFinished) return;
    state.combatFinished = true;
    // Only the host decides the fight outcome — guest waits for auth state / result.
    if (!isAuthority()) {
      state.pendingResult = state.pendingResult || null;
      return;
    }
    const live = computeResultFromField();
    let results = Array.isArray(state.roundResults) ? state.roundResults.slice() : [];
    if (playerCount() <= 2) {
      // Classic 1v1: live board is the truth.
      const idx = results.findIndex((r) => r.leftPid === live.leftPid && r.rightPid === live.rightPid);
      if (idx >= 0) results[idx] = live;
      else results = [live];
      state.pendingResult = live;
    } else {
      // 3–4 player: shared pairing estimates keep every client on the same HP outcomes.
      if (!results.length) results = [live];
      state.pendingResult = results.find((r) => r.leftPid === state.fightSides?.[0] && r.rightPid === state.fightSides?.[1]) || results[0];
    }
    state.roundResults = results;
    publishAuthState(true);
    broadcastAction({
      type: 'tft_combat_result',
      result: live,
      results,
      armies: state.players.map((p) => serializeArmy(p)),
    });
    setTimeout(() => {
      applyCombatResults(results);
      publishAuthState(true);
    }, 1100);
  }

  function applyOneFightResult(result, announce = true) {
    if (!result) return;
    const win = result.winnerPid != null ? result.winnerPid : (result.winner === 0 ? (result.leftPid ?? 0) : (result.rightPid ?? 1));
    const loser = result.loserPid != null ? result.loserPid : (win === (result.leftPid ?? 0) ? (result.rightPid ?? 1) : (result.leftPid ?? 0));
    if (!state.players[win] || !state.players[loser]) return;
    if (state.players[loser].hp <= 0) return;
    state.players[loser].hp = Math.max(0, state.players[loser].hp - result.damage);
    state.players[win].winStreak += 1;
    state.players[win].lossStreak = 0;
    state.players[loser].lossStreak += 1;
    state.players[loser].winStreak = 0;
    if (announce) {
      pushMsg(`${state.players[win].name} wins! ${state.players[loser].name} −${result.damage} HP (${state.players[loser].hp})`);
    }
  }

  function applyCombatResult(result) {
    applyCombatResults(result ? [result] : []);
  }

  function applyCombatResults(results) {
    if (!state) return;
    if (state.phase !== 'combat' && state.phase !== 'result') return;
    if (state.resultApplied) return;
    state.resultApplied = true;
    state.combatFinished = true;
    const list = Array.isArray(results) && results.length
      ? results
      : (Array.isArray(state.roundResults) ? state.roundResults : []);
    state.pendingResult = list[0] || state.pendingResult;
    state.lastCombat = list[0] || null;
    for (const r of list) applyOneFightResult(r, true);
    if (state.byePid != null && state.players[state.byePid]?.hp > 0) {
      pushMsg(`${state.players[state.byePid].name} has a bye this round.`);
    }
    state.phase = 'result';
    state.resultTimer = 3.2;
    setShellMode('result');
    renderHud();
    if (isAuthority()) publishAuthState(true);
    const living = alivePlayers();
    if (living.length <= 1) {
      endMatch(living[0]?.id ?? match.playerId);
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
    const planned = opts.pairings
      ? { pairs: opts.pairings, bye: opts.byePid ?? null }
      : buildPairings(state.combatSeed);
    state.pairings = planned.pairs;
    state.byePid = planned.bye;
    state.roundResults = [];

    // Host resolves every pairing (live fight for local view; estimates for others).
    if (isAuthority() && !opts.fromRemote) {
      for (const pair of state.pairings) {
        const pairSeed = hashSeed(`${match.roomId}|fight|${state.round}|${pair[0]}|${pair[1]}|${state.combatSeed}`);
        state.roundResults.push(simulatePairingResult(pair[0], pair[1], pairSeed));
      }
    } else if (Array.isArray(opts.results)) {
      state.roundResults = opts.results.slice();
    }

    const myPair = myPairing();
    if (myPair) {
      state.fightSides = [myPair[0], myPair[1]];
    } else if (state.pairings[0]) {
      state.fightSides = state.pairings[0].slice();
    } else {
      state.fightSides = [match.playerId, match.playerId];
    }

    setShellMode('combat');
    resizeCanvas();

    const onBye = state.byePid === match.playerId || !myPair;
    if (onBye && playerCount() > 2) {
      state.combatUnits = [];
      state.projectiles = [];
      state.floatTexts = [];
      state.combatElapsed = 0;
      state.combatIntro = 0;
      pushMsg(state.byePid === match.playerId
        ? 'Bye round — you rest while others fight.'
        : 'Watching other matchups…');
      renderHud();
      if (isAuthority() && !opts.fromRemote) {
        broadcastAction({
          type: 'tft_combat_start',
          seed: state.combatSeed,
          pairings: state.pairings,
          byePid: state.byePid,
          results: state.roundResults,
          armies: state.players.map((p) => serializeArmy(p)),
        });
        publishAuthState(true);
        setTimeout(() => {
          if (!active || !state || state.phase !== 'combat') return;
          applyCombatResults(state.roundResults);
          publishAuthState(true);
        }, 2200);
      }
      return;
    }

    spawnCombatUnits(state.fightSides[0], state.fightSides[1]);
    requestAnimationFrame(() => {
      if (!active || !state || state.phase !== 'combat') return;
      resizeCanvas();
      if (!state.combatUnits?.length) spawnCombatUnits(state.fightSides[0], state.fightSides[1]);
      drawCombat();
      if (isAuthority()) publishAuthState(true);
    });
    pushMsg(`Battle — ${fightLabel(state.fightSides[0], state.fightSides[1])}!`);
    sfx('fight');
    renderHud();
    if (isAuthority() && !opts.fromRemote) {
      broadcastAction({
        type: 'tft_combat_start',
        seed: state.combatSeed,
        pairings: state.pairings,
        byePid: state.byePid,
        results: state.roundResults,
        armies: state.players.map((p) => serializeArmy(p)),
      });
      publishAuthState(true);
    }
  }

  function ensureBoardHasUnit(p) {
    if (!p || boardCount(p) > 0) return;
    for (let i = 0; i < BENCH; i++) {
      const unit = p.bench[i];
      if (!unit) continue;
      const slot = cpuFindBoardSlot(p, unit);
      if (!slot) break;
      p.board[slot.r][slot.c] = unit;
      p.bench[i] = null;
      break;
    }
  }

  function forceShopTimeout() {
    if (!state || state.phase !== 'planning') return;
    for (const p of state.players) {
      ensureBoardHasUnit(p);
      p.ready = true;
    }
    state.planTimeLeft = 0;
    pushMsg('Shop timer ended — fight!');
    renderHud();
    if (isAuthority()) beginCombat();
  }

  function augmentTierForRound(round) {
    return AUGMENT_TIER_BY_ROUND[round] || 'silver';
  }

  function shouldOfferAugment(round = state?.round) {
    return AUGMENT_ROUNDS.includes(round);
  }

  function rollAugmentChoices(p, tier) {
    const owned = new Set(p.augments || []);
    const pool = Object.values(AUGMENTS).filter((a) => a.tier === tier && !owned.has(a.id));
    const fallback = Object.values(AUGMENTS).filter((a) => !owned.has(a.id));
    const use = pool.length >= 3 ? pool : (fallback.length ? fallback : Object.values(AUGMENTS));
    const seed = hashSeed(`${match.roomId}|aug|${state.round}|p${p.id}|${(p.augments || []).join(',')}`);
    const rng = mulberry32(seed ^ (state.round * 9973) ^ ((p.id + 1) * 131));
    const shuffled = use.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, 3).map((a) => a.id);
  }

  function scoreAugmentForCpu(p, augId) {
    const a = AUGMENTS[augId];
    if (!a) return -999;
    let score = a.tier === 'prismatic' ? 52 : a.tier === 'gold' ? 30 : 15;
    const press = (typeof cpuPressure === 'function') ? cpuPressure(p) : { behind: false };
    const behind = !!press.behind;
    const round = state?.round || 1;
    if (a.combat) score += 40;
    if (a.boardBonus) score += 26 * a.boardBonus + (p.level < 7 ? 14 : 4);
    if (a.traitBonus) {
      score += 28;
      const primary = cpuPrimaryTrait(p);
      for (const [tid, n] of Object.entries(a.traitBonus)) {
        score += 18 * n;
        if (tid === primary) score += 36;
        const owned = new Set(listArmy(p).map((x) => x.unit.type));
        const have = [...owned].filter((t) => TRAITS[tid]?.units.includes(t)).length;
        if (have >= 1) score += 16;
      }
    }
    if (a.playerDmgBonus) score += behind ? 32 : 12;
    if (a.sellMult) score += 6;
    if (a.rerollCost != null) score += (behind || round >= 4) ? 22 : 12;
    if (a.interestBonus) score += p.gold >= 20 ? 14 : 4;
    if (a.incomeFlat) score += 16;
    if (typeof a.instant === 'function') {
      if (a.id.includes('gold') || a.id === 'treasure_trove' || a.id === 'dragon_hoard') {
        score += p.gold < 16 ? 32 : (behind ? 18 : 8);
      }
      if (a.id.includes('training') || a.id.includes('promotion')) {
        score += p.level < 5 ? 28 : (p.level < 7 ? 14 : 4);
      }
    }
    if (boardCount(p) <= 0 && a.id === 'scout_contract') score += 34;
    if (behind && a.combat) score += 16;
    if (round >= 5 && a.combat) score += 10;
    return score;
  }

  function applyAugmentPick(p, augId, announce = true) {
    const a = AUGMENTS[augId];
    if (!a || !p) return false;
    if (!Array.isArray(p.augments)) p.augments = [];
    if (p.augments.includes(augId)) return false;
    p.augments.push(augId);
    p.augmentChoices = null;
    if (typeof a.instant === 'function') a.instant(p);
    if (announce) pushMsg(`${p.name} chose ${a.name}`);
    return true;
  }

  function bothAugmentsPicked() {
    return state.players.every((p) => !p.augmentChoices || p.augmentChoices.length === 0);
  }

  function pickAugment(augId, fromPlayerId = match.playerId) {
    if (!state || state.phase !== 'augment') return false;
    const p = state.players[fromPlayerId];
    if (!p?.augmentChoices?.includes(augId)) return false;
    applyAugmentPick(p, augId, true);
    if (fromPlayerId === match.playerId) {
      broadcastAction({ type: 'tft_augment_pick', playerId: fromPlayerId, augmentId: augId });
      syncArmy(p);
    }
    renderHud();
    if (bothAugmentsPicked()) {
      if (isAuthority()) beginPlanningPhase();
    } else if (isAuthority()) {
      publishAuthState(true);
    }
    return true;
  }

  function autoPickAugments() {
    for (const p of state.players) {
      if (!p.augmentChoices?.length) continue;
      let best = p.augmentChoices[0];
      let bestScore = -Infinity;
      for (const id of p.augmentChoices) {
        const s = scoreAugmentForCpu(p, id);
        if (s > bestScore) {
          bestScore = s;
          best = id;
        }
      }
      applyAugmentPick(p, best, true);
    }
  }

  function beginAugmentPhase() {
    $('tft-howto')?.classList.add('hidden');
    state.phase = 'augment';
    state.augmentTimeLeft = AUGMENT_TIME_SEC;
    state.planTimeLeft = PLAN_TIME_SEC;
    state.combatUnits = [];
    state.projectiles = [];
    state.floatTexts = [];
    state.combatFinished = false;
    state.resultApplied = false;
    state.pendingResult = null;
    selected = null;
    waitElapsed = 0;
    cpuThinkAcc = 0;
    const tier = augmentTierForRound(state.round);
    for (const p of state.players) {
      p.ready = false;
      p.augmentChoices = rollAugmentChoices(p, tier);
    }
    setShellMode('augment');
    pushMsg(`Round ${state.round} — choose an augment (${tier})!`);
    renderHud();
    if (isAuthority()) publishAuthState(true);
  }

  function beginPlanningPhase() {
    state.phase = 'planning';
    state.augmentTimeLeft = 0;
    state.combatUnits = [];
    state.projectiles = [];
    state.floatTexts = [];
    state.combatFinished = false;
    state.resultApplied = false;
    state.pendingResult = null;
    state.planTimeLeft = PLAN_TIME_SEC;
    selected = null;
    cpuThinkAcc = 0;
    cpuRerollsThisRound = 0;
    cpuXpBuysThisRound = 0;
    cpuActionsThisRound = 0;
    waitElapsed = 0;
    for (const p of state.players) {
      p.ready = false;
      p.augmentChoices = null;
      if (!Number.isFinite(p.gold) || p.gold < 0) p.gold = START_GOLD;
      p.gold += incomeFor(p);
      rollShop(p);
      rollItemShop(p);
      if (!Array.isArray(p.itemBag)) p.itemBag = Array(ITEM_BAG).fill(null);
      if (state.round >= 2) {
        const free = COMPONENT_IDS[(state.round + p.id) % COMPONENT_IDS.length];
        if (grantItemToBag(p, free) && p.id === match.playerId) {
          pushMsg(`Loot: ${itemDef(free).name} added to your item bag.`);
        }
      }
    }
    pushMsg(`Round ${state.round} — ${PLAN_TIME_SEC}s to shop. Buy items, equip (combine 2 parts), Ready early.`);
    setShellMode('planning');
    renderHud();
    showHowtoOnce();
    if (isAuthority()) publishPlanningSnapshot();
  }

  function startRound() {
    if (shouldOfferAugment(state.round)) beginAugmentPhase();
    else beginPlanningPhase();
  }

  function endMatch(winnerSlot) {
    state.phase = 'gameover';
    setShellMode('gameover');
    pushMsg(winnerSlot === match.playerId ? 'Victory!' : 'Defeat');
    renderHud();
    if (isAuthority() && !isVsCpu()) publishAuthState(true);
    if (!isVsCpu()) {
      window.TDG_PVP?.notifyGameOver?.({ winnerSlot, endReason: 'base_destroyed' });
    }
  }

  function showHowtoOnce() {
    try {
      if (localStorage.getItem('tdg_tft_howto_seen')) return;
      localStorage.setItem('tdg_tft_howto_seen', '1');
      $('tft-howto')?.classList.remove('hidden');
    } catch {
      // ignore storage failures
    }
  }

  function goHomeFromTft() {
    if (!isVsCpu() && window.TDG_PVP?.goHome) {
      window.TDG_PVP.goHome();
      return;
    }
    cleanup(true);
    $('tft-game-screen')?.classList.add('hidden');
    $('menu-screen')?.classList.remove('hidden');
    if (typeof phase !== 'undefined') phase = 'menu';
    if (typeof gameMode !== 'undefined') gameMode = null;
  }

  function setShellMode(mode) {
    const shell = document.querySelector('#tft-game-screen .tft-shell');
    if (!shell) return;
    shell.classList.toggle('is-combat', mode === 'combat');
    shell.classList.toggle('is-planning', mode === 'planning' || mode === 'augment');
    shell.classList.toggle('is-augment', mode === 'augment');
    shell.classList.toggle('is-result', mode === 'result' || mode === 'gameover');
  }

  // ─── Player actions ────────────────────────────────────────────────────────

  function tryBuy(shopIdx) {
    const p = me();
    if (state.phase !== 'planning' || p.ready) return false;
    const type = p.shop[shopIdx];
    if (!type) return false;
    const cost = unitCost(type);
    if (p.gold < cost) {
      pushMsg(`Need ${cost}g for ${baseStats(type).name}.`);
      return false;
    }
    const slot = emptyBenchSlot(p);
    if (slot < 0) {
      pushMsg('Bench full — sell or place a unit.');
      return false;
    }
    p.gold -= cost;
    p.bench[slot] = makeUnit(type, 1);
    p.shop[shopIdx] = null;
    selected = { area: 'bench', idx: slot };
    sfx('buy');
    tryAutoMerge(p, true);
    syncArmy(p);
    renderHud();
    flashGold();
    return true;
  }

  function trySell(ref) {
    const p = me();
    if (state.phase !== 'planning' || p.ready) return false;
    const unit = getUnitAt(p, ref);
    if (!unit) return false;
    returnUnitItemsToBag(p, unit);
    const gained = sellValue(unit, p);
    setUnitAt(p, ref, null);
    p.gold += gained;
    if (selected && sameRef(selected, ref)) selected = null;
    pushMsg(`Sold for ${gained}g`);
    sfx('sell');
    syncArmy(p);
    renderHud();
    flashGold();
    return true;
  }

  function flashGold() {
    const el = $('tft-gold')?.closest('.tft-stat');
    if (!el) return;
    el.classList.remove('tft-gold-flash');
    void el.offsetWidth;
    el.classList.add('tft-gold-flash');
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
    const cost = rerollCostFor(p);
    if (state.phase !== 'planning' || p.ready || p.gold < cost) return false;
    p.gold -= cost;
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
    if (val && boardCount(p) <= 0) {
      pushMsg('Place at least one unit before Ready.');
      return;
    }
    p.ready = val;
    waitElapsed = 0;
    syncArmy(p);
    broadcastAction({ type: 'tft_ready', ready: val, playerId: match.playerId });
    if (val) sfx('ready');
    renderHud();
    checkPlanningEnd();
  }

  function checkPlanningEnd() {
    if (state.phase !== 'planning') return;
    const living = alivePlayers();
    if (!living.length || !living.every((p) => p.ready)) return;
    // Only the host starts combat; guest waits for tft_combat_start / auth state.
    if (isAuthority()) beginCombat();
  }

  function applyRemoteArmies(armies) {
    if (!armies) return;
    while (state.players.length < armies.length) {
      const i = state.players.length;
      state.players.push(freshPlayer(i, armies[i]?.name || `Player ${i + 1}`));
    }
    for (let i = 0; i < armies.length; i++) {
      const snap = armies[i];
      if (!snap) continue;
      if (!state.players[i]) continue;
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
        if (target && targetId !== match.playerId) {
          applyArmySnapshot(target, action.army);
          // Host mirrors guest shop/board so both UIs stay consistent.
          if (isAuthority()) publishAuthState(true);
        }
        renderHud();
        return true;
      }
      case 'tft_request_sync':
        if (isAuthority()) publishAuthState(true);
        return true;
      case 'tft_augment_pick': {
        const targetId = action.playerId ?? fromPlayerId;
        const target = state.players[targetId];
        const augId = action.augmentId;
        if (target && state.phase === 'augment' && target.augmentChoices?.includes(augId)) {
          applyAugmentPick(target, augId, true);
          if (isAuthority()) {
            publishAuthState(true);
            if (bothAugmentsPicked()) beginPlanningPhase();
          }
          renderHud();
        }
        return true;
      }
      case 'tft_ready':
        if (p) p.ready = !!action.ready;
        if (isAuthority()) publishAuthState(true);
        renderHud();
        checkPlanningEnd();
        return true;
      case 'tft_combat_start':
        if (!isAuthority() && (state.phase === 'planning' || state.phase === 'result' || state.phase === 'combat')) {
          applyRemoteArmies(action.armies);
          beginCombat({
            seed: action.seed,
            fromRemote: true,
            force: true,
            pairings: action.pairings,
            byePid: action.byePid,
            results: action.results,
          });
        }
        return true;
      case 'tft_combat_result':
        if (isAuthority()) return true;
        if (state.phase === 'planning') {
          applyRemoteArmies(action.armies);
          beginCombat({
            force: true,
            fromRemote: true,
            seed: action.seed,
            pairings: action.pairings,
            byePid: action.byePid,
            results: action.results,
          });
        }
        // Host result is the only HP truth — ignore any local guess.
        {
          const results = Array.isArray(action.results) && action.results.length
            ? action.results
            : (action.result ? [action.result] : null);
          if (results && (state.phase === 'combat' || state.phase === 'result')) {
            state.combatFinished = true;
            state.pendingResult = results[0];
            state.roundResults = results;
            setTimeout(() => applyCombatResults(results), state.phase === 'result' ? 0 : 400);
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
    const sell = $('tft-sell-zone');
    if (sell && drag.unit) sell.textContent = `Sell for ${sellValue(drag.unit, me())}g`;
  }

  function highlightSelection() {
    document.querySelectorAll('.tft-board-cell.is-selected, .tft-bench-slot.is-selected, .tft-shop-card.is-inspect, .tft-item-bag-slot.is-selected')
      .forEach((el) => el.classList.remove('is-selected', 'is-inspect'));
    if (!selected) return;
    if (selected.area === 'board') {
      document.querySelector(`#tft-board .tft-board-cell[data-r="${selected.r}"][data-c="${selected.c}"]`)
        ?.classList.add('is-selected');
    } else if (selected.area === 'bench') {
      document.querySelector(`#tft-bench [data-bench="${selected.idx}"]`)?.classList.add('is-selected');
    } else if (selected.area === 'shop') {
      document.querySelector(`#tft-shop [data-shop="${selected.idx}"]`)?.classList.add('is-inspect');
    } else if (selected.area === 'item') {
      document.querySelector(`#tft-item-bag [data-item-bag="${selected.idx}"]`)?.classList.add('is-selected');
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
      if (selected?.area === 'item' && !me().ready) {
        tryEquipItem(selected.idx, { area: 'board', r, c });
        selected = { area: 'board', r, c };
        return;
      }
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
      if (selected?.area === 'item' && !me().ready) {
        tryEquipItem(selected.idx, { area: 'bench', idx });
        selected = { area: 'bench', idx };
        return;
      }
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
    const burst = performance.now() < mergeBurstUntil ? ' tft-merge-burst' : '';
    const items = (unit.items || []).map((id) => itemDef(id)).filter(Boolean);
    const itemHtml = items.length
      ? `<span class="tft-item-row">${items.map((it) => `<span class="tft-item-dot" title="${escapeHtml(it.name)}">${it.icon}</span>`).join('')}</span>`
      : '';
    return `<div class="tft-unit-chip star-${star}${burst}" data-type="${unit.type}">`
      + `<img src="/TDG/portraits/${unit.type}.webp" alt="" draggable="false" />`
      + `<span class="tft-star-badge">${starLabel(star)}</span>`
      + `<span class="tft-unit-cost">${def.cost}</span>`
      + itemHtml
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
    if (selected.area === 'item') {
      if (!me()?.itemBag?.[selected.idx]) selected = null;
      return;
    }
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
    if (selected?.area === 'item') {
      const id = me()?.itemBag?.[selected.idx];
      const def = itemDef(id);
      if (!def) {
        el.innerHTML = '<div class="tft-inspect-empty">Select a unit to see its stats</div>';
        return;
      }
      el.innerHTML = `
        <div class="tft-inspect-head">
          <div class="tft-inspect-item-icon">${def.icon || '◆'}</div>
          <div>
            <div class="tft-inspect-title">${escapeHtml(def.name)}</div>
            <div class="tft-inspect-sub">${escapeHtml(def.desc || '')}</div>
          </div>
        </div>
        <div class="tft-inspect-traits">
          Item selected — click a board or bench unit to equip.
          <br>Click this bag slot again to sell it.
          <br><span style="opacity:0.75">Two components on one unit forge a completed item.</span>
        </div>
      `;
      return;
    }
    const unit = selectedUnit();
    if (!unit) {
      el.innerHTML = '<div class="tft-inspect-empty">Select a unit · or click an item bag slot to equip</div>';
      return;
    }
    const star = unit.star || 1;
    const base = scaledStats(unit.type, star);
    const counts = traitCounts(me());
    const withTraits = applyTraitsToStats({ ...base }, counts);
    const withAug = applyAugmentsToCombatStats(withTraits, me());
    const withAll = applyItemsToCombatStats(withAug, unit.items || []);
    const traitNames = traitsForType(unit.type).map((t) => t.name);
    const canUnequip = selected?.area === 'board' || selected?.area === 'bench';
    const itemBtns = (unit.items || []).map((id, i) => {
      const def = itemDef(id);
      if (!def) return '';
      if (!canUnequip || state.phase !== 'planning' || me().ready) {
        return `<span class="tft-inspect-item-chip" title="${escapeHtml(def.desc || '')}">${def.icon} ${escapeHtml(def.name)}</span>`;
      }
      return `<button type="button" class="tft-inspect-item-chip is-btn" data-unequip-item="${i}" title="Unequip ${escapeHtml(def.name)}">${def.icon} ${escapeHtml(def.name)} · unequip</button>`;
    }).filter(Boolean).join('');
    const dps = Math.round(withAll.damage * withAll.attackRate);
    el.innerHTML = `
      <div class="tft-inspect-head">
        <img src="/TDG/portraits/${unit.type}.webp" alt="" />
        <div>
          <div class="tft-inspect-title">${escapeHtml(base.name)} ${starLabel(star)}</div>
          <div class="tft-inspect-sub">${formatRole(base.role)} · Cost ${base.cost}g · Sell ${sellValue(unit, me())}g</div>
        </div>
      </div>
      <div class="tft-inspect-grid">
        <div><span>HP</span><br><strong>${withAll.hp}</strong></div>
        <div><span>Damage</span><br><strong>${withAll.damage}</strong></div>
        <div><span>Atk speed</span><br><strong>${withAll.attackRate.toFixed(2)}/s</strong></div>
        <div><span>DPS</span><br><strong>${dps}</strong></div>
        <div><span>Range</span><br><strong>${withAll.range}</strong></div>
        <div><span>Move</span><br><strong>${withAll.speed}</strong></div>
      </div>
      <div class="tft-inspect-traits">
        ${traitNames.length ? `Traits: ${traitNames.join(', ')}` : 'No traits'}
        <div class="tft-inspect-item-list">${itemBtns || '<span style="opacity:0.65">Items: none — select a bag item, then click this unit</span>'}</div>
        ${withAll.hp !== base.hp || withAll.damage !== base.damage || Math.abs(withAll.attackRate - base.attackRate) > 0.001
          ? `<span style="opacity:0.75">Trait / augment / item bonuses applied</span>` : ''}
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
    const augmenting = state.phase === 'augment';
    const setText = (id, text) => { const el = $(id); if (el) el.textContent = text; };
    const living = alivePlayers();
    const readyCount = living.filter((x) => x.ready).length;

    setText('tft-round-label', `Round ${state.round}`);
    const shopSecs = Math.max(0, Math.ceil(state.planTimeLeft ?? PLAN_TIME_SEC));
    const augSecs = Math.max(0, Math.ceil(state.augmentTimeLeft ?? 0));
    const phaseEl = $('tft-phase-label');
    if (phaseEl) {
      phaseEl.textContent = augmenting
        ? `Augment · ${augSecs}s`
        : planning
          ? `Shop · ${shopSecs}s`
          : state.phase === 'combat' ? `Fight · ${Math.ceil(state.combatElapsed || 0)}s`
            : state.phase === 'result' ? 'Round result'
              : 'Game Over';
      phaseEl.classList.toggle('is-urgent', (planning && shopSecs <= 5) || (augmenting && augSecs <= 5));
    }
    setText('tft-you-hp', String(p.hp));
    setText('tft-them-hp', o ? String(o.hp) : '—');
    setText('tft-gold', String(p.gold));
    setText('tft-level', `Lv ${p.level} (${p.xp}/${LEVEL_XP[p.level] ?? 'MAX'})`);
    setText('tft-board-cap', `${boardCount(p)}/${boardCap(p)}`);
    setText('tft-you-name', p.name);
    setText('tft-them-name', o ? o.name : (state.byePid === match.playerId ? 'BYE' : 'Lobby'));
    const standings = $('tft-standings');
    if (standings) {
      standings.innerHTML = state.players.map((pl) => {
        const cls = [
          'tft-standing',
          pl.id === match.playerId ? 'is-you' : '',
          o && pl.id === o.id ? 'is-foe' : '',
          pl.hp <= 0 ? 'is-out' : '',
        ].filter(Boolean).join(' ');
        return `<span class="${cls}">${escapeHtml(pl.name)} ${pl.hp}</span>`;
      }).join('');
    }
    setText('tft-them-ready',
      augmenting
        ? (p.augmentChoices?.length
          ? (isVsCpu() ? 'Pick an augment' : (living.some((x) => x.id !== match.playerId && x.augmentChoices?.length) ? 'Players choosing…' : 'Others picked ✓'))
          : (isVsCpu() ? 'CPU choosing…' : 'Waiting on lobby…'))
        : isVsCpu()
          ? (o?.ready ? 'CPU ready ✓' : 'CPU shopping…')
          : (readyCount >= living.length && living.length
            ? 'All ready'
            : p.ready ? `Waiting ${readyCount}/${living.length} · ${Math.floor(waitElapsed)}s`
              : `Shopping… ${readyCount}/${living.length} ready`));
    setText('tft-income-preview', planning ? `+${incomeFor(p)}g next · merge 3× same ★` : '');

    const augOwned = $('tft-augments');
    if (augOwned) {
      const list = playerAugments(p);
      augOwned.innerHTML = list.length
        ? list.map((a) => `<div class="tft-augment-chip tier-${a.tier}" title="${escapeHtml(a.desc)}">`
          + `<span class="tft-augment-icon">${a.icon || '◆'}</span>`
          + `<span class="tft-augment-name">${escapeHtml(a.name)}</span>`
          + `</div>`).join('')
        : '<div class="tft-augment-empty">Augments appear on rounds 1, 3, and 5</div>';
    }

    const augOverlay = $('tft-augment-pick');
    if (augOverlay) {
      const choices = augmenting ? (p.augmentChoices || []) : [];
      const show = augmenting && choices.length > 0;
      augOverlay.classList.toggle('hidden', !show);
      if (show) {
        const tier = augmentTierForRound(state.round);
        const title = $('tft-augment-title');
        if (title) title.textContent = `Choose an augment · ${tier}`;
        const grid = $('tft-augment-choices');
        if (grid) {
          grid.innerHTML = choices.map((id) => {
            const a = AUGMENTS[id];
            if (!a) return '';
            return `<button type="button" class="tft-augment-card tier-${a.tier}" data-augment="${a.id}">`
              + `<span class="tft-augment-card-icon">${a.icon || '◆'}</span>`
              + `<span class="tft-augment-card-name">${escapeHtml(a.name)}</span>`
              + `<span class="tft-augment-card-tier">${a.tier}</span>`
              + `<span class="tft-augment-card-desc">${escapeHtml(a.desc)}</span>`
              + `</button>`;
          }).join('');
        }
      }
    }

    const sellZone = $('tft-sell-zone');
    if (sellZone) {
      const dragUnit = drag?.unit;
      sellZone.textContent = dragUnit
        ? `Sell for ${sellValue(dragUnit, me())}g`
        : 'Sell zone · drop here';
    }

    const shopEl = $('tft-shop');
    if (shopEl) {
      const shopSlots = Array.isArray(p.shop) && p.shop.length === SHOP
        ? p.shop
        : Array(SHOP).fill(null);
      shopEl.innerHTML = shopSlots.map((type, i) => {
        if (!type) return `<div class="tft-shop-card is-empty"></div>`;
        const def = baseStats(type);
        const cost = unitCost(type);
        const afford = p.gold >= cost && emptyBenchSlot(p) >= 0;
        const owned1 = countOwned(p, type, 1);
        const mergeHint = owned1 >= 2 ? 'tft-shop-merge' : '';
        const inspect = selected?.area === 'shop' && selected.idx === i ? ' is-inspect' : '';
        const buyHint = inspect
          ? '<span class="tft-shop-owned">Click again to buy</span>'
          : (owned1 ? `<span class="tft-shop-owned">${owned1}/3</span>` : '');
        return `<button type="button" class="tft-shop-card ${mergeHint}${inspect}${afford ? '' : ' is-disabled'}" data-shop="${i}" ${planning ? '' : 'disabled'}>`
          + `<img src="/TDG/portraits/${type}.webp" alt="" draggable="false" />`
          + `<span class="tft-shop-name">${escapeHtml(def.name)}</span>`
          + `<span class="tft-shop-cost">${cost}g</span>`
          + buyHint
          + `</button>`;
      }).join('');
    }


    const itemShopEl = $('tft-item-shop');
    if (itemShopEl) {
      const slots = Array.isArray(p.itemShop) ? p.itemShop : Array(ITEM_SHOP).fill(null);
      itemShopEl.innerHTML = slots.map((id, i) => {
        if (!id) return `<div class="tft-item-card is-empty"></div>`;
        const def = itemDef(id);
        const afford = planning && !p.ready && p.gold >= ITEM_COMPONENT_COST && emptyItemBagSlot(p) >= 0;
        return `<button type="button" class="tft-item-card${afford ? '' : ' is-disabled'}" data-item-shop="${i}" ${planning && !p.ready ? '' : 'disabled'}>`
          + `<span class="tft-item-icon">${def?.icon || '◆'}</span>`
          + `<span class="tft-item-name">${escapeHtml(def?.name || id)}</span>`
          + `<span class="tft-item-cost">${ITEM_COMPONENT_COST}g</span>`
          + `<span class="tft-item-desc">${escapeHtml(def?.desc || '')}</span>`
          + `</button>`;
      }).join('');
    }

    const itemBagEl = $('tft-item-bag');
    if (itemBagEl) {
      const bag = Array.isArray(p.itemBag) ? p.itemBag : Array(ITEM_BAG).fill(null);
      itemBagEl.innerHTML = bag.map((id, i) => {
        if (!id) return `<div class="tft-item-bag-slot" data-item-bag="${i}"></div>`;
        const def = itemDef(id);
        const sel = selected?.area === 'item' && selected.idx === i ? ' is-selected' : '';
        return `<button type="button" class="tft-item-bag-slot has-item${sel}" data-item-bag="${i}" title="${escapeHtml((def?.name || '') + ' — ' + (def?.desc || ''))}">`
          + `<span>${def?.icon || '◆'}</span>`
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
      if (state.phase === 'gameover') {
        readyBtn.disabled = false;
        readyBtn.textContent = 'Go home';
        readyBtn.classList.remove('is-waiting', 'needs-army');
      } else {
        readyBtn.disabled = !planning;
        if (state.phase === 'augment') {
          readyBtn.disabled = true;
          readyBtn.textContent = 'Choose augment';
        } else if (state.phase === 'combat') readyBtn.textContent = 'Fighting…';
        else if (state.phase === 'result') readyBtn.textContent = 'Round done';
        else if (p.ready) readyBtn.textContent = 'Unready';
        else readyBtn.textContent = boardCount(p) ? 'Ready' : 'Place a unit';
        readyBtn.classList.toggle('is-waiting', planning && p.ready);
        readyBtn.classList.toggle('needs-army', planning && !p.ready && boardCount(p) <= 0);
      }
    }
    const rerollBtn = $('tft-reroll-btn');
    if (rerollBtn) {
      const rc = rerollCostFor(p);
      rerollBtn.textContent = `Reroll (${rc}g)`;
      rerollBtn.disabled = !planning || p.ready || p.gold < rc || state.phase === 'gameover';
    }
    if ($('tft-xp-btn')) $('tft-xp-btn').disabled = !planning || p.ready || p.gold < XP_COST || p.level >= MAX_LEVEL || state.phase === 'gameover';
    if ($('tft-forfeit-btn')) $('tft-forfeit-btn').disabled = state.phase === 'gameover';
  }

  // ─── Combat / arena draw (sprites) ─────────────────────────────────────────

  function drawArenaBackground() {
    const layout = beginLogicDraw();
    if (!layout || !ctx) return null;
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
    const laneH = (h - padY * 2) / ROWS;
    ctx.fillStyle = 'rgba(255,255,255,0.035)';
    for (let i = 1; i < ROWS; i++) {
      ctx.fillRect(padX, padY + laneH * i, w - padX * 2, 1);
    }

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
    const deadScale = u.alive === false ? Math.max(0.35, 1 - (u.deathT || 0) * 0.65) : 1;
    const strikePunch = (u.attackPhase === 'strike' && (u.attackProgress || 0) < 0.55) ? 1.08 : 1;
    const sz = Math.max(16, (u.size || 20) * (1 + ((u.star || 1) - 1) * 0.12) * deadScale * strikePunch);
    ctx.save();
    ctx.globalAlpha = alpha * (u.alive === false ? Math.max(0, 1 - (u.deathT || 0)) : 1);

    drawPortraitFallback(u, sz);

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

    if ((u.hitFlash || 0) > 0.05) {
      ctx.globalAlpha = Math.min(0.55, u.hitFlash * 0.65);
      ctx.fillStyle = '#fff5f0';
      ctx.beginPath();
      ctx.arc(u.x, u.y, sz * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = alpha * (u.alive === false ? Math.max(0, 1 - (u.deathT || 0)) : 1);
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
      const pct = Math.max(0, Math.min(1, (u.hp ?? u.maxHp) / u.maxHp));
      ctx.fillStyle = pct < 0.3 ? '#e76f51' : (u.owner === 0 ? '#4ECDC4' : '#FF8E53');
      ctx.fillRect(bx, by, bw * pct, 6);
    }
    ctx.restore();
  }

  /** Idle placement preview during planning — same left/right sides as combat. */
  function drawPlanningPreview() {
    if (!ctx || !canvas || !state) return;
    const layout = drawArenaBackground();
    if (!layout) return;
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
    endLogicDraw();
  }

  function drawCombat() {
    if (!ctx || !canvas || !state) return;
    const layout = drawArenaBackground();
    if (!layout) return;
    const { w, h } = layout;

    const drawList = (state.combatUnits || []).slice().sort((a, b) => a.y - b.y);
    for (const u of drawList) {
      const alpha = u.alive ? 1 : Math.max(0, 1 - u.deathT);
      if (alpha <= 0.02) continue;
      drawUnitSpriteAt(u, alpha);
    }

    for (const p of state.projectiles || []) {
      const ang = Math.atan2((p.ty ?? p.y) - p.y, (p.tx ?? p.x) - p.x);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(ang);
      ctx.fillStyle = p.color || '#fff';
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.ellipse(0, 0, 9, 3.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.35;
      ctx.fillRect(-16, -1.2, 12, 2.4);
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    for (const f of state.floatTexts || []) {
      ctx.globalAlpha = Math.max(0, f.life);
      ctx.fillStyle = f.color || '#fff';
      ctx.font = '700 14px Orbitron, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(f.text, f.x, f.y);
      ctx.globalAlpha = 1;
    }

    // Fight timer bar
    const introLeft = Math.max(0, state.combatIntro || 0);
    const tPct = Math.max(0, Math.min(1, 1 - (state.combatElapsed || 0) / COMBAT_MAX_SEC));
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(w * 0.25, 8, w * 0.5, 7);
    ctx.fillStyle = introLeft > 0 ? '#f0d878' : '#7cb87c';
    ctx.fillRect(w * 0.25, 8, w * 0.5 * (introLeft > 0 ? introLeft / COMBAT_INTRO : tPct), 7);
    if (introLeft > 0) {
      ctx.fillStyle = '#f0d878';
      ctx.font = '800 18px Orbitron, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('FIGHT!', w / 2, h * 0.5);
    }

    if (state.combatFinished && state.pendingResult) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, h * 0.38, w, 64);
      ctx.fillStyle = '#f0d878';
      ctx.font = '700 22px Orbitron, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${state.players[state.pendingResult.winner]?.name || 'Winner'} wins`, w / 2, h * 0.38 + 28);
      ctx.font = '600 13px Rajdhani, sans-serif';
      ctx.fillStyle = '#e8ebe0';
      ctx.fillText(`−${state.pendingResult.damage} HP`, w / 2, h * 0.38 + 50);
      ctx.textAlign = 'left';
    }
    endLogicDraw();
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

  // ─── CPU opponent (local vs CPU) ────────────────────────────────────────────
  // Plays to win: fight-power matches combat (traits + augments + items),
  // stage plans by round/HP, chases merges & trait breakpoints, equips smartly.

  function cpuHuman() {
    return state?.players?.[match?.playerId] || null;
  }

  function cpuTraitCountsForTypes(types, p) {
    const counts = {};
    const set = new Set(types);
    for (const [tid, tr] of Object.entries(TRAITS)) {
      counts[tid] = [...set].filter((t) => tr.units.includes(t)).length;
    }
    for (const a of playerAugments(p)) {
      if (!a.traitBonus) continue;
      for (const [tid, n] of Object.entries(a.traitBonus)) {
        counts[tid] = (counts[tid] || 0) + n;
      }
    }
    return counts;
  }

  function cpuCombatStats(unit, counts, p) {
    let st = applyTraitsToStats(scaledStats(unit.type, unit.star || 1), counts || {});
    st = applyAugmentsToCombatStats(st, p);
    st = applyItemsToCombatStats(st, unit.items || []);
    return st;
  }

  function cpuUnitFightValue(unit, counts, p) {
    const st = cpuCombatStats(unit, counts, p);
    const role = st.role || baseStats(unit.type).role || 'melee';
    let power = st.hp * st.damage * (st.attackRate || 0.8);
    if (role === 'tank') power *= 1.16;
    else if (role === 'carry') power *= 1.28;
    else if (role === 'ranged') power *= 1.14;
    else power *= 1.05;
    if ((st.range || 0) >= 120) power *= 1.08;
    power *= 1 + ((unit.star || 1) - 1) * 0.12;
    return power / 1000;
  }

  function cpuBoardUnits(p) {
    const units = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (p.board[r][c]) units.push(p.board[r][c]);
      }
    }
    return units;
  }

  function cpuRoleBalance(units) {
    let tanks = 0;
    let dps = 0;
    for (const u of units) {
      const role = baseStats(u.type).role;
      if (role === 'tank' || role === 'melee') tanks += 1;
      else dps += 1;
    }
    if (!units.length) return 0.4;
    let mult = 1;
    if (units.length >= 2 && tanks === 0) mult *= 0.68;
    if (units.length >= 2 && dps === 0) mult *= 0.74;
    if (units.length >= 3 && tanks >= 1 && dps >= 1) mult *= 1.12;
    if (units.length >= 4 && tanks >= 1 && dps >= 2) mult *= 1.06;
    return mult;
  }

  function cpuTraitSynergyMult(counts) {
    let bonus = 1;
    for (const [tid, tr] of Object.entries(TRAITS)) {
      const n = counts[tid] || 0;
      for (let i = 0; i < tr.breakpoints.length; i++) {
        if (n >= tr.breakpoints[i]) bonus += 0.12 + i * 0.08;
      }
      const next = tr.breakpoints.find((b) => n < b);
      if (next && next - n === 1) bonus += 0.03;
    }
    return bonus;
  }

  function cpuArmyPower(units, p) {
    if (!units?.length) return 0;
    const counts = cpuTraitCountsForTypes(units.map((u) => u.type), p);
    let sum = 0;
    for (const u of units) sum += cpuUnitFightValue(u, counts, p);
    return sum * cpuTraitSynergyMult(counts) * cpuRoleBalance(units);
  }

  function cpuBoardPower(p) {
    return cpuArmyPower(cpuBoardUnits(p), p);
  }

  function cpuUnitPower(type, star, counts, items) {
    return cpuUnitFightValue({ type, star: star || 1, items: items || [] }, counts || {}, cpuPlayer() || me());
  }

  function cpuCountsFromTypes(types) {
    return cpuTraitCountsForTypes(types, cpuPlayer() || me());
  }

  function cpuTraitBonus(counts) {
    return cpuTraitSynergyMult(counts);
  }

  function cpuPrimaryTrait(p) {
    const owned = new Set(listArmy(p).map((x) => x.unit.type));
    let bestId = null;
    let best = -1;
    for (const [tid, tr] of Object.entries(TRAITS)) {
      const n = [...owned].filter((t) => tr.units.includes(t)).length;
      let score = n * 4;
      if (n >= tr.breakpoints[0]) score += 14;
      if (tr.breakpoints[1] && n >= tr.breakpoints[1]) score += 10;
      for (const a of playerAugments(p)) {
        if (a.traitBonus?.[tid]) score += 20;
      }
      const next = tr.breakpoints.find((b) => n < b);
      if (next && next - n === 1) score += 9;
      if (score > best) {
        best = score;
        bestId = tid;
      }
    }
    return bestId;
  }

  function cpuOppNeeds(p) {
    const foe = state.players[1 - p.id] || state.players[0];
    const units = cpuBoardUnits(foe);
    let tanks = 0;
    let ranged = 0;
    for (const u of units) {
      const role = baseStats(u.type).role;
      if (role === 'tank' || role === 'melee') tanks += 1;
      if (role === 'ranged' || role === 'carry') ranged += 1;
    }
    return {
      tanks,
      ranged,
      power: cpuBoardPower(foe),
      empty: units.length === 0,
      hp: foe.hp,
    };
  }

  function cpuPressure(p) {
    const human = cpuHuman();
    if (!human) return { behind: false, desperate: false, ahead: false, powerGap: 0, hpGap: 0 };
    const myP = cpuBoardPower(p);
    const theirP = cpuBoardPower(human);
    const powerGap = myP - theirP;
    const hpGap = (p.hp || 0) - (human.hp || 0);
    return {
      behind: powerGap < -4 || hpGap <= -20,
      desperate: powerGap < -18 || (p.hp || 100) <= 40,
      ahead: powerGap > 10 && hpGap >= 0,
      powerGap,
      hpGap,
      myP,
      theirP,
    };
  }

  function cpuStage(p) {
    const round = state.round || 1;
    const press = cpuPressure(p);
    if (press.desperate) return 'all_in';
    if (press.behind) return round <= 2 ? 'stabilize' : 'all_in';
    if (round <= 2) return 'stabilize';
    if (round <= 4) return boardCount(p) >= boardCap(p) ? 'level_or_roll' : 'stabilize';
    if (round <= 6) return 'roll';
    return 'highroll';
  }

  function cpuWouldBreakInterest(p, spend) {
    const before = Math.min(5, Math.floor(p.gold / 10));
    const after = Math.min(5, Math.floor((p.gold - spend) / 10));
    return after < before;
  }

  function cpuShouldBank(p, spend) {
    const press = cpuPressure(p);
    if (press.behind || press.desperate) return false;
    const stage = cpuStage(p);
    if (stage === 'all_in' || stage === 'roll' || stage === 'highroll') return false;
    if ((state.round || 1) <= 2 && boardCount(p) < boardCap(p)) return false;
    return cpuWouldBreakInterest(p, spend) && p.gold < 50 && press.ahead;
  }

  function cpuScoreUnitList(units, p) {
    return cpuArmyPower(units, p);
  }

  function cpuPickBestLineup(p) {
    const all = listArmy(p).map((x) => x.unit).filter(Boolean);
    const cap = boardCap(p);
    if (!all.length) return [];
    if (all.length <= cap) return all.slice();

    const guessCounts = cpuTraitCountsForTypes(all.map((u) => u.type), p);
    const primary = cpuPrimaryTrait(p);
    const ranked = all.slice().sort((a, b) => {
      let sa = cpuUnitFightValue(a, guessCounts, p);
      let sb = cpuUnitFightValue(b, guessCounts, p);
      if (primary) {
        if (TRAITS[primary].units.includes(a.type)) sa *= 1.2;
        if (TRAITS[primary].units.includes(b.type)) sb *= 1.2;
      }
      if (countOwned(p, a.type, a.star || 1) >= 2) sa *= 1.08;
      if (countOwned(p, b.type, b.star || 1) >= 2) sb *= 1.08;
      return sb - sa;
    });

    let best = ranked.slice(0, cap);
    let bestScore = cpuScoreUnitList(best, p);
    const rest = ranked.slice(cap);
    for (let i = 0; i < best.length; i++) {
      for (let j = 0; j < rest.length; j++) {
        const trial = best.slice();
        trial[i] = rest[j];
        const score = cpuScoreUnitList(trial, p);
        if (score > bestScore + 0.35) {
          bestScore = score;
          const kicked = best[i];
          best[i] = rest[j];
          rest[j] = kicked;
        }
      }
    }
    return best;
  }

  function cpuProjectedPowerAfterBuy(p, type) {
    const pieces = listArmy(p).map((x) => ({
      type: x.unit.type,
      star: x.unit.star || 1,
      items: (x.unit.items || []).slice(),
      id: x.unit.id,
    }));
    pieces.push({ type, star: 1, items: [], id: `buy-${type}` });

    const mergeOnce = (star) => {
      const idxs = [];
      for (let i = 0; i < pieces.length; i++) {
        if (pieces[i].type === type && pieces[i].star === star) idxs.push(i);
      }
      if (idxs.length < 3 || star >= MAX_STAR) return false;
      const keptItems = [];
      for (let k = 0; k < 3; k++) {
        for (const id of (pieces[idxs[k]].items || [])) {
          if (keptItems.length < ITEM_SLOTS) keptItems.push(id);
        }
      }
      for (let k = 2; k >= 0; k--) pieces.splice(idxs[k], 1);
      pieces.push({ type, star: star + 1, items: keptItems, id: `m-${type}-${star}` });
      return true;
    };
    while (mergeOnce(1)) { /* 1★ */ }
    while (mergeOnce(2)) { /* 2★ */ }

    const cap = boardCap(p);
    const guessCounts = cpuTraitCountsForTypes(pieces.map((u) => u.type), p);
    const ranked = pieces.slice().sort((a, b) => (
      cpuUnitFightValue(b, guessCounts, p) - cpuUnitFightValue(a, guessCounts, p)
    ));
    return cpuArmyPower(ranked.slice(0, Math.min(cap, ranked.length)), p);
  }

  function cpuScoreShopCard(p, type) {
    if (!type) return -999;
    const cost = unitCost(type);
    if (p.gold < cost) return -999;

    const before = cpuBoardPower(p);
    const after = cpuProjectedPowerAfterBuy(p, type);
    const delta = after - before;
    let score = delta * 14 + (after / Math.max(1, cost)) * 0.5;

    const owned1 = countOwned(p, type, 1);
    const owned2 = countOwned(p, type, 2);
    if (owned1 >= 2) score += 120;
    else if (owned1 === 1) score += 38;
    if (owned2 >= 2) score += 140;
    else if (owned2 === 1) score += 48;

    const primary = cpuPrimaryTrait(p);
    const ownedTypes = new Set(listArmy(p).map((x) => x.unit.type));
    for (const tr of traitsForType(type)) {
      const armyN = [...ownedTypes].filter((t) => TRAITS[tr.id].units.includes(t)).length
        + (ownedTypes.has(type) ? 0 : 1);
      const bp = TRAITS[tr.id].breakpoints;
      if (armyN === bp[0]) score += 42;
      if (bp[1] && armyN === bp[1]) score += 55;
      if (tr.id === primary) score += 24;
      const boardN = (traitCounts(p)[tr.id] || 0);
      if (boardN + 1 === bp[0]) score += 28;
    }

    const mine = cpuBoardUnits(p);
    let myTanks = 0;
    let myDps = 0;
    for (const u of mine) {
      const role = baseStats(u.type).role;
      if (role === 'tank' || role === 'melee') myTanks += 1;
      else myDps += 1;
    }
    const role = baseStats(type).role;
    if (mine.length < boardCap(p)) {
      if (myTanks === 0 && (role === 'tank' || role === 'melee')) score += 36;
      if (myDps === 0 && (role === 'ranged' || role === 'carry')) score += 32;
      if (role === 'tank') score += 10;
      if (role === 'carry') score += 14;
      if (role === 'ranged') score += 10;
    }

    const foe = cpuOppNeeds(p);
    if (!foe.empty) {
      if (foe.ranged >= 2 && (role === 'tank' || role === 'melee')) score += 20;
      if (foe.tanks >= 2 && (role === 'carry' || role === 'ranged')) score += 20;
      if (foe.power > before && cost >= 3) score += 12;
    }

    if (mine.length === 0) score += 55 + cpuUnitFightValue({ type, star: 1, items: [] }, {}, p) * 2;
    if ((state.round || 1) >= 5 && cost >= 4) score += 10;
    if ((state.round || 1) >= 6 && cost >= 5) score += 14;
    if (mine.length >= boardCap(p) && delta < 1.5 && owned1 < 2 && owned2 < 2) score *= 0.5;
    if (cpuShouldBank(p, cost) && delta < 4 && owned1 < 2 && owned2 < 2) score *= 0.4;
    return score;
  }

  function cpuBuyBest(p) {
    let bought = false;
    for (let pass = 0; pass < SHOP; pass++) {
      let bestIdx = -1;
      let bestScore = 5;
      for (let i = 0; i < SHOP; i++) {
        const type = p.shop[i];
        if (!type) continue;
        const score = cpuScoreShopCard(p, type);
        if (score > bestScore) {
          bestScore = score;
          bestIdx = i;
        }
      }
      if (bestIdx < 0) break;
      const type = p.shop[bestIdx];
      const cost = unitCost(type);
      if (emptyBenchSlot(p) < 0) {
        if (!cpuSellWeakBench(p)) break;
      }
      const slot = emptyBenchSlot(p);
      if (slot < 0 || p.gold < cost) break;
      if (cpuShouldBank(p, cost) && bestScore < 40) break;
      p.gold -= cost;
      p.bench[slot] = makeUnit(type, 1);
      p.shop[bestIdx] = null;
      tryAutoMerge(p, false);
      bought = true;
    }
    return bought;
  }

  function cpuBuyXp(p) {
    if (p.gold < XP_COST || p.level >= MAX_LEVEL) return false;
    if (cpuXpBuysThisRound >= 12) return false;
    const press = cpuPressure(p);
    const stage = cpuStage(p);
    const full = boardCount(p) >= boardCap(p);
    const wantLevel = full
      || (stage === 'level_or_roll' && p.level < 7)
      || (stage === 'highroll' && p.level < 8)
      || (press.ahead && p.gold >= 28 && p.level < 7)
      || ((state.round || 1) >= 3 && p.level < 5 && p.gold >= XP_COST + 8);
    if (!wantLevel) return false;
    if (press.desperate && !full && p.gold < XP_COST + 8) return false;
    if (cpuShouldBank(p, XP_COST) && !full) return false;
    p.gold -= XP_COST;
    grantXp(p, XP_PER_BUY);
    cpuXpBuysThisRound += 1;
    return true;
  }

  function cpuReroll(p) {
    const cost = rerollCostFor(p);
    if (cpuRerollsThisRound >= 18 || p.gold < cost) return false;
    let best = -999;
    for (let i = 0; i < SHOP; i++) best = Math.max(best, cpuScoreShopCard(p, p.shop[i]));
    const press = cpuPressure(p);
    const stage = cpuStage(p);
    const keepThreshold = press.desperate ? 45 : press.behind ? 34 : (stage === 'highroll' ? 28 : 26);
    if (best >= keepThreshold) return false;
    if (cpuShouldBank(p, cost) && best >= 12) return false;
    if (emptyBenchSlot(p) < 0 && !cpuSellWeakBench(p) && best < 60) return false;
    p.gold -= cost;
    rollShop(p);
    cpuRerollsThisRound += 1;
    return true;
  }

  function cpuPreferredCol(unit) {
    const role = baseStats(unit.type).role;
    if (role === 'tank' || role === 'melee') return 0;
    if (role === 'ranged' || role === 'carry') return COLS - 1;
    return 1;
  }

  function cpuFindBoardSlot(p, unit) {
    const preferred = cpuPreferredCol(unit);
    const order = [preferred];
    for (let c = 0; c < COLS; c++) if (c !== preferred) order.push(c);
    for (const c of order) {
      for (let r = 0; r < ROWS; r++) {
        if (!p.board[r][c]) return { area: 'board', r, c };
      }
    }
    return null;
  }

  function cpuOptimizeBoard(p) {
    const keepers = cpuPickBestLineup(p);
    if (!keepers.length && !listArmy(p).length) return false;
    const keepIds = new Set(keepers.map((u) => u.id));

    const pool = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (p.board[r][c]) {
          pool.push(p.board[r][c]);
          p.board[r][c] = null;
        }
      }
    }
    for (let i = 0; i < BENCH; i++) {
      if (p.bench[i]) {
        pool.push(p.bench[i]);
        p.bench[i] = null;
      }
    }

    const onBoard = pool.filter((u) => keepIds.has(u.id));
    const rest = pool.filter((u) => !keepIds.has(u.id));
    onBoard.sort((a, b) => {
      const ca = cpuPreferredCol(a);
      const cb = cpuPreferredCol(b);
      if (ca !== cb) return ca - cb;
      return (b.star || 1) - (a.star || 1);
    });
    for (const u of onBoard) {
      const slot = cpuFindBoardSlot(p, u);
      if (slot) p.board[slot.r][slot.c] = u;
      else rest.push(u);
    }
    let bi = 0;
    for (const u of rest) {
      while (bi < BENCH && p.bench[bi]) bi += 1;
      if (bi >= BENCH) break;
      p.bench[bi] = u;
      bi += 1;
    }
    tryAutoMerge(p, false);
    return true;
  }

  function cpuPlaceFromBench(p) {
    if (boardCount(p) >= boardCap(p) && listArmy(p).every((x) => x.area === 'board' || !x.unit)) {
      // Still allow re-optimize swaps via full optimize.
    }
    const before = boardCount(p);
    const beforePower = cpuBoardPower(p);
    cpuOptimizeBoard(p);
    return boardCount(p) > before || cpuBoardPower(p) > beforePower + 0.2;
  }

  function cpuSellWeakBench(p) {
    if (emptyBenchSlot(p) >= 0) return false;
    const primary = cpuPrimaryTrait(p);
    let worstIdx = -1;
    let worstScore = Infinity;
    for (let i = 0; i < BENCH; i++) {
      const u = p.bench[i];
      if (!u) continue;
      if (countOwned(p, u.type, u.star || 1) >= 2) continue;
      if ((u.items || []).length && emptyItemBagSlot(p) < 0) continue;
      let score = cpuUnitFightValue(u, traitCounts(p), p);
      if (primary && TRAITS[primary].units.includes(u.type)) score *= 1.45;
      if ((u.star || 1) >= 2) score *= 1.6;
      if (score < worstScore) {
        worstScore = score;
        worstIdx = i;
      }
    }
    if (worstIdx < 0) return false;
    const unit = p.bench[worstIdx];
    returnUnitItemsToBag(p, unit);
    p.gold += sellValue(unit, p);
    p.bench[worstIdx] = null;
    return true;
  }

  function cpuEmergencyBuy(p) {
    let bestIdx = -1;
    let bestScore = -999;
    for (let i = 0; i < SHOP; i++) {
      const t = p.shop[i];
      if (!t) continue;
      if (unitCost(t) > p.gold || emptyBenchSlot(p) < 0) continue;
      const score = cpuUnitFightValue({ type: t, star: 1, items: [] }, {}, p)
        + (baseStats(t).role === 'tank' ? 4 : 0)
        + (baseStats(t).role === 'carry' ? 3 : 0);
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
    if (bestIdx < 0) return false;
    const type = p.shop[bestIdx];
    const slot = emptyBenchSlot(p);
    p.gold -= unitCost(type);
    p.bench[slot] = makeUnit(type, 1);
    p.shop[bestIdx] = null;
    cpuOptimizeBoard(p);
    return boardCount(p) > 0;
  }

  function cpuItemRoleScore(itemId, role) {
    const dmg = new Set(['blade', 'bow', 'rod', 'glove', 'infinity_edge', 'rapid_fire', 'guinsoo', 'rabadon', 'gauntlet', 'shojin', 'runaan']);
    const tank = new Set(['vest', 'warmog', 'titans', 'guardian', 'steadfast']);
    const hybrid = new Set(['bloodthirster', 'cloak']);
    if (role === 'tank') {
      if (tank.has(itemId)) return 22;
      if (hybrid.has(itemId)) return 14;
      return 3;
    }
    if (role === 'melee') {
      if (hybrid.has(itemId)) return 16;
      if (dmg.has(itemId)) return 12;
      if (tank.has(itemId)) return 10;
      return 5;
    }
    if (role === 'carry' || role === 'ranged') {
      if (dmg.has(itemId)) return 22;
      if (hybrid.has(itemId)) return 12;
      return 3;
    }
    return 6;
  }

  function cpuConsolidateItems(p) {
    let moved = false;
    for (let i = 0; i < BENCH; i++) {
      const u = p.bench[i];
      if (!u?.items?.length) continue;
      while (u.items.length && emptyItemBagSlot(p) >= 0) {
        const id = u.items.pop();
        grantItemToBag(p, id);
        moved = true;
      }
    }
    return moved;
  }

  function cpuEquipBestItem(p) {
    if (!Array.isArray(p.itemBag)) return false;
    cpuConsolidateItems(p);
    const army = listArmy(p).filter((x) => x.area === 'board');
    const pool = army.length ? army : listArmy(p);
    if (!pool.length) return false;

    let best = null;
    let bestScore = -Infinity;
    for (let bagIdx = 0; bagIdx < p.itemBag.length; bagIdx++) {
      const itemId = p.itemBag[bagIdx];
      if (!itemId) continue;
      for (const slot of pool) {
        const unit = slot.unit;
        if (!Array.isArray(unit.items)) unit.items = [];
        const role = baseStats(unit.type).role;
        let score = cpuItemRoleScore(itemId, role);
        score += (unit.star || 1) * 10;
        score += slot.area === 'board' ? 25 : 0;
        score += cpuUnitFightValue(unit, traitCounts(p), p) * 0.15;
        score -= unit.items.length * 8;
        let forge = false;
        if (ITEM_COMPONENTS[itemId]) {
          for (const other of unit.items) {
            if (combineItems(itemId, other)) { forge = true; break; }
          }
        }
        if (forge) score += 70;
        else if (unit.items.length >= ITEM_SLOTS) continue;
        if (ITEM_COMPLETED[itemId]) score += 16;
        if (score > bestScore) {
          bestScore = score;
          best = { bagIdx, itemId, unit };
        }
      }
    }
    if (!best) return false;
    const { bagIdx, itemId, unit } = best;
    if (ITEM_COMPONENTS[itemId]) {
      for (let i = 0; i < unit.items.length; i++) {
        const made = combineItems(itemId, unit.items[i]);
        if (made) {
          unit.items[i] = made;
          p.itemBag[bagIdx] = null;
          return true;
        }
      }
    }
    if (unit.items.length >= ITEM_SLOTS) return false;
    unit.items.push(itemId);
    p.itemBag[bagIdx] = null;
    return true;
  }

  function cpuBuyItem(p) {
    if (!Array.isArray(p.itemShop) || p.gold < ITEM_COMPONENT_COST) return false;
    if (emptyItemBagSlot(p) < 0) return false;
    const press = cpuPressure(p);
    let bestIdx = -1;
    let bestScore = 6;
    const owned = [];
    for (const id of (p.itemBag || [])) if (id) owned.push(id);
    for (const x of listArmy(p)) for (const id of (x.unit.items || [])) owned.push(id);

    for (let i = 0; i < ITEM_SHOP; i++) {
      const id = p.itemShop[i];
      if (!id) continue;
      let score = 8;
      for (const o of owned) if (combineItems(id, o)) score += 55;
      for (const u of cpuBoardUnits(p)) {
        score += cpuItemRoleScore(id, baseStats(u.type).role) * 0.2 * (u.star || 1);
      }
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
    if (bestIdx < 0) return false;
    const completes = bestScore >= 55;
    if (!completes && cpuShouldBank(p, ITEM_COMPONENT_COST) && !press.behind) return false;
    if (!completes && boardCount(p) <= 0) return false;
    if (!completes && bestScore < 12 && !press.behind) return false;
    p.gold -= ITEM_COMPONENT_COST;
    grantItemToBag(p, p.itemShop[bestIdx]);
    p.itemShop[bestIdx] = null;
    return true;
  }

  function cpuFinishAndReady(p) {
    cpuOptimizeBoard(p);
    cpuConsolidateItems(p);
    while (cpuEquipBestItem(p)) { /* slam remaining items */ }
    cpuOptimizeBoard(p);
    if (boardCount(p) <= 0) cpuEmergencyBuy(p);
    if (boardCount(p) <= 0) return false;
    p.ready = true;
    waitElapsed = 0;
    renderHud();
    checkPlanningEnd();
    return true;
  }

  function cpuDoNextAction(p) {
    if (!p || p.ready || state.phase !== 'planning') return;
    cpuActionsThisRound += 1;

    const timeLeft = state.planTimeLeft ?? PLAN_TIME_SEC;
    const stage = cpuStage(p);
    const press = cpuPressure(p);

    if (timeLeft <= 1.8 || cpuActionsThisRound >= 70) {
      cpuFinishAndReady(p);
      return;
    }

    if (boardCount(p) <= 0) {
      if (cpuPlaceFromBench(p) || cpuBuyBest(p) || cpuEmergencyBuy(p)) {
        renderHud();
        return;
      }
    }

    if (cpuEquipBestItem(p)) { renderHud(); return; }
    if (cpuBuyItem(p)) { renderHud(); return; }
    if (emptyBenchSlot(p) < 0 && cpuSellWeakBench(p)) { renderHud(); return; }

    if (stage === 'stabilize') {
      if (cpuBuyBest(p)) { renderHud(); return; }
      if (boardCount(p) < boardCap(p) && cpuPlaceFromBench(p)) { renderHud(); return; }
      if (cpuBuyXp(p)) { renderHud(); return; }
      if (press.behind && cpuReroll(p)) { renderHud(); return; }
    } else if (stage === 'level_or_roll') {
      if (cpuBuyBest(p)) { renderHud(); return; }
      if (boardCount(p) >= boardCap(p) && cpuBuyXp(p)) { renderHud(); return; }
      if (cpuReroll(p)) { renderHud(); return; }
      if (cpuBuyXp(p)) { renderHud(); return; }
    } else if (stage === 'roll' || stage === 'all_in' || stage === 'highroll') {
      if (cpuBuyBest(p)) { renderHud(); return; }
      if (cpuReroll(p)) { renderHud(); return; }
      if (boardCount(p) >= boardCap(p) && cpuBuyXp(p)) { renderHud(); return; }
      if (cpuBuyXp(p)) { renderHud(); return; }
    } else {
      if (cpuBuyBest(p)) { renderHud(); return; }
      if (cpuReroll(p)) { renderHud(); return; }
      if (cpuBuyXp(p)) { renderHud(); return; }
    }

    if (timeLeft > 5) {
      cpuOptimizeBoard(p);
      if ((press.behind || press.desperate) && p.gold >= rerollCostFor(p) + 2) {
        if (cpuReroll(p)) { renderHud(); return; }
      }
      if (p.gold >= 12 && cpuReroll(p)) { renderHud(); return; }
      renderHud();
      return;
    }

    cpuFinishAndReady(p);
  }

  function tickCpuAugment(dt) {
    if (!isVsCpu() || state.phase !== 'augment') return;
    const cpu = cpuPlayer();
    if (!cpu?.augmentChoices?.length) return;
    cpuThinkAcc += dt;
    if (cpuThinkAcc < 0.28) return;
    cpuThinkAcc = 0;
    let best = cpu.augmentChoices[0];
    let bestScore = -Infinity;
    for (const id of cpu.augmentChoices) {
      const s = scoreAugmentForCpu(cpu, id);
      if (s > bestScore) {
        bestScore = s;
        best = id;
      }
    }
    applyAugmentPick(cpu, best, true);
    renderHud();
    if (bothAugmentsPicked()) beginPlanningPhase();
  }

  function tickCpuPlanning(dt) {
    if (!isVsCpu() || state.phase !== 'planning') return;
    const cpu = cpuPlayer();
    if (!cpu || cpu.ready) return;
    cpuThinkAcc += dt;
    const timeLeft = state.planTimeLeft ?? PLAN_TIME_SEC;
    const rush = timeLeft <= 14 || me().ready || cpuPressure(cpu).desperate;
    const delay = rush ? 0.05 : (state.round === 1 ? 0.11 : 0.07);
    if (cpuThinkAcc < delay) return;
    cpuThinkAcc = 0;
    cpuDoNextAction(cpu);
  }


  function tickAugmentTimer(dt) {
    if (!isAuthority() || state.phase !== 'augment') return;
    const prevCeil = Math.ceil(state.augmentTimeLeft ?? 0);
    state.augmentTimeLeft = Math.max(0, (state.augmentTimeLeft ?? AUGMENT_TIME_SEC) - dt);
    const nextCeil = Math.ceil(state.augmentTimeLeft);
    if (nextCeil !== prevCeil) {
      renderHud();
      if (!isVsCpu()) publishAuthState(true);
    }
    if (state.augmentTimeLeft <= 0) {
      autoPickAugments();
      beginPlanningPhase();
    }
  }

  function tickShopTimer(dt) {
    if (!isAuthority() || state.phase !== 'planning') return;
    if (state.players[0].ready && state.players[1].ready) return;
    const prevCeil = Math.ceil(state.planTimeLeft ?? PLAN_TIME_SEC);
    state.planTimeLeft = Math.max(0, (state.planTimeLeft ?? PLAN_TIME_SEC) - dt);
    const nextCeil = Math.ceil(state.planTimeLeft);
    if (nextCeil !== prevCeil) {
      renderHud();
      if (!isVsCpu()) publishAuthState(true);
    }
    if (state.planTimeLeft <= 0) forceShopTimeout();
  }

  function tick(dt) {
    if (!active || !state) return;
    if (state.phase === 'augment') {
      tickCpuAugment(dt);
      tickAugmentTimer(dt);
      drawPlanningPreview();
    } else if (state.phase === 'planning') {
      tickCpuPlanning(dt);
      tickShopTimer(dt);
      const o = opp();
      if (me().ready || (o && o.ready) || alivePlayers().some((p) => p.ready)) {
        waitElapsed += dt;
        if (Math.floor(waitElapsed) !== Math.floor(waitElapsed - dt)) renderHud();
      }
      drawPlanningPreview();
    } else if (state.phase === 'combat') {
      const localMulti = playerCount() > 2 && !!myPairing() && !isAuthority();
      if (isAuthority() || localMulti) {
        // Guests in 3–4p lobbies sim their own pairing for visuals; HP still host-owned.
        const finishedBefore = state.combatFinished;
        tickCombat(dt);
        if (localMulti && state.combatFinished && !finishedBefore) {
          // Don't apply HP locally — wait for host results.
          state.combatFinished = true;
        }
        if (isAuthority()) {
          authSyncAcc += dt;
          if (authSyncAcc >= AUTH_SYNC_MS / 1000) {
            authSyncAcc = 0;
            publishAuthState(false);
          }
        }
      } else {
        tickGuestCombatVisual(dt);
      }
      drawCombat();
    } else if (state.phase === 'result') {
      drawCombat();
      if (isAuthority()) {
        state.resultTimer -= dt;
        if (state.resultTimer <= 0) {
          state.round += 1;
          startRound();
        }
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
      const already = selected?.area === 'shop' && selected.idx === idx;
      selected = { area: 'shop', idx };
      if (!me().ready && already) tryBuy(idx);
      else renderHud();
    });
    $('tft-item-shop')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-item-shop]');
      if (!btn || state?.phase !== 'planning' || me().ready) return;
      tryBuyItem(Number(btn.getAttribute('data-item-shop')));
    });
    $('tft-item-bag')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-item-bag]');
      if (!btn || state?.phase !== 'planning' || me().ready) return;
      const idx = Number(btn.getAttribute('data-item-bag'));
      const id = me().itemBag?.[idx];
      if (!id) return;
      const already = selected?.area === 'item' && selected.idx === idx;
      if (already) {
        trySellItem(idx);
        selected = null;
      } else {
        selected = { area: 'item', idx };
        pushMsg(`${itemDef(id)?.name || 'Item'} selected — click a unit to equip (or click again to sell).`);
      }
      renderHud();
      highlightSelection();
    });
    $('tft-inspect')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-unequip-item]');
      if (!btn || !selected || (selected.area !== 'board' && selected.area !== 'bench')) return;
      const itemIndex = Number(btn.getAttribute('data-unequip-item'));
      tryUnequipItem(selected, itemIndex);
    });
    $('tft-reroll-btn')?.addEventListener('click', () => tryReroll());
    $('tft-xp-btn')?.addEventListener('click', () => tryBuyXp());
    $('tft-augment-choices')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-augment]');
      if (!btn || state?.phase !== 'augment') return;
      pickAugment(btn.getAttribute('data-augment'), match.playerId);
    });
    const howto = $('tft-howto');
    const openHowto = () => howto?.classList.remove('hidden');
    const closeHowto = () => howto?.classList.add('hidden');
    $('tft-howto-btn')?.addEventListener('click', openHowto);
    $('tft-howto-close')?.addEventListener('click', closeHowto);
    howto?.addEventListener('click', (e) => {
      if (e.target === howto) closeHowto();
    });
    $('tft-ready-btn')?.addEventListener('click', () => {
      if (state?.phase === 'gameover') {
        goHomeFromTft();
        return;
      }
      setReady(!me().ready);
    });
    $('tft-forfeit-btn')?.addEventListener('click', () => {
      if (isVsCpu()) {
        state.players[match.playerId].hp = 0;
        endMatch(1 - match.playerId);
        return;
      }
      window.TDG_PVP?.forfeitMatch?.();
      applyForfeit(match.playerId);
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
    const vsCpu = !!opts.vsCpu;
    const roster = Array.isArray(opts.roster) && opts.roster.length >= 2
      ? opts.roster.slice().sort((a, b) => Number(a.slot) - Number(b.slot))
      : [
        { slot: 0, name: opts.player0Name || 'You' },
        { slot: 1, name: opts.player1Name || (vsCpu ? 'CPU' : 'Player 2') },
      ];
    const myId = Number.isFinite(Number(opts.myPlayerId)) ? Number(opts.myPlayerId) : 0;
    const hostSlot = Math.min(...roster.map((r) => Number(r.slot)));
    match = {
      playerId: myId,
      isHost: vsCpu ? true : (opts.isHost != null ? !!opts.isHost : myId === hostSlot),
      vsCpu,
      roomId: opts.roomId || (vsCpu ? 'local-cpu' : 'local'),
      player0Name: roster.find((r) => Number(r.slot) === 0)?.name || opts.player0Name || 'You',
      player1Name: roster.find((r) => Number(r.slot) === 1)?.name || opts.player1Name || (vsCpu ? 'CPU' : 'Player 2'),
      roster,
    };
    const players = [];
    for (const r of roster) {
      const slot = Number(r.slot);
      players[slot] = freshPlayer(slot, r.name || `Player ${slot + 1}`);
    }
    // Dense array (fill holes if slots skipped)
    for (let i = 0; i < players.length; i++) {
      if (!players[i]) players[i] = freshPlayer(i, `Player ${i + 1}`);
    }
    state = {
      phase: 'planning',
      round: 1,
      planTimeLeft: PLAN_TIME_SEC,
      augmentTimeLeft: 0,
      players,
      pairings: [],
      byePid: null,
      fightSides: [0, 1],
      roundResults: [],
      combatUnits: [],
      projectiles: [],
      floatTexts: [],
      messages: [],
      combatFinished: false,
      resultApplied: false,
    };
    selected = null;
    gotAuthSnapshot = false;
    cpuThinkAcc = 0;
    cpuRerollsThisRound = 0;
    cpuXpBuysThisRound = 0;
    cpuActionsThisRound = 0;
    active = true;
    canvas = $('tft-combat-canvas');
    ctx = canvas?.getContext('2d') || null;
    resizeCanvas();

    $('menu-screen')?.classList.add('hidden');
    $('bottom-panel')?.classList.add('hidden');
    $('tft-game-screen')?.classList.remove('hidden');
    if (typeof gameMode !== 'undefined') gameMode = vsCpu ? 'tft-cpu' : 'tft-pvp';
    if (typeof phase !== 'undefined') phase = 'tft';

    UNIT_POOL.forEach(getPortrait);
    bindUi();
    const resumeSnap = !vsCpu && opts.resume && opts.savedState && opts.savedState.mode === 'tft'
      && Array.isArray(opts.savedState.players) && opts.savedState.players.length >= 2
      ? opts.savedState
      : null;
    // Host owns round 1 economy/shop; guest waits for the first auth snapshot.
    if (isAuthority()) {
      if (resumeSnap) {
        // Restore local snapshot after refresh, then republish for the guest.
        state.round = Math.max(1, resumeSnap.round || 1);
        state.phase = resumeSnap.phase || 'planning';
        state.planTimeLeft = resumeSnap.planTimeLeft != null ? resumeSnap.planTimeLeft : PLAN_TIME_SEC;
        state.augmentTimeLeft = resumeSnap.augmentTimeLeft != null ? resumeSnap.augmentTimeLeft : 0;
        state.combatSeed = resumeSnap.combatSeed || 0;
        state.combatElapsed = resumeSnap.combatElapsed || 0;
        state.combatIntro = resumeSnap.combatIntro || 0;
        state.combatFinished = !!resumeSnap.combatFinished;
        state.resultApplied = !!resumeSnap.resultApplied;
        state.resultTimer = resumeSnap.resultTimer || 0;
        state.pendingResult = resumeSnap.pendingResult || null;
        state.lastCombat = resumeSnap.lastCombat || null;
        if (Array.isArray(resumeSnap.messages)) state.messages = resumeSnap.messages.slice();
        while (state.players.length < resumeSnap.players.length) {
          const i = state.players.length;
          state.players.push(freshPlayer(i, resumeSnap.players[i]?.name || `Player ${i + 1}`));
        }
        for (let i = 0; i < resumeSnap.players.length; i++) applyArmySnapshot(state.players[i], resumeSnap.players[i]);
        if (Array.isArray(resumeSnap.pairings)) state.pairings = resumeSnap.pairings;
        if (resumeSnap.byePid != null) state.byePid = resumeSnap.byePid;
        if (Array.isArray(resumeSnap.fightSides)) state.fightSides = resumeSnap.fightSides;
        if (Array.isArray(resumeSnap.roundResults)) state.roundResults = resumeSnap.roundResults;
        // Guard against corrupt snaps wiping economy.
        for (const p of state.players) {
          if (!Number.isFinite(p.gold) || p.gold < 0) p.gold = START_GOLD;
          if (!Array.isArray(p.shop) || p.shop.length !== SHOP) p.shop = Array(SHOP).fill(null);
        }
        if (Array.isArray(resumeSnap.combatUnits)) applyCombatUnitsFromAuth(resumeSnap.combatUnits);
        if (Array.isArray(resumeSnap.projectiles)) state.projectiles = resumeSnap.projectiles.slice();
        setShellMode(state.phase === 'gameover' ? 'gameover' : state.phase);
        pushMsg(`Rejoined game · Round ${state.round}`);
        renderHud();
        if (state.phase === 'planning') {
          for (const p of state.players) {
            if (!shopHasCards(p)) rollShop(p);
          }
          publishPlanningSnapshot();
        } else {
          publishAuthState(true);
        }
      } else {
        pushMsg(vsCpu
          ? 'TFT vs CPU — shop, merge, place, then Ready. Tap How to play anytime.'
          : 'TFT Online — shop, merge, place, then Ready. Tap How to play anytime.');
        startRound();
      }
    } else {
      state.phase = 'planning';
      setShellMode('planning');
      // Apply any state that arrived before TFT finished booting.
      const buffered = resumeSnap || window.TDG_PVP?.getLastTftAuthState?.();
      if (buffered) applyAuthState(buffered);
      ensureLocalShopVisible();
      pushMsg(shopHasCards(me()) ? `Round ${state.round} — shop is ready` : 'Synced match — loading shop…');
      renderHud();
      showHowtoOnce();
      requestHostSync();
      [400, 1200, 2800].forEach((ms) => {
        setTimeout(() => {
          if (!active || isAuthority() || state?.phase !== 'planning') return;
          if (!gotAuthSnapshot || !shopHasCards(me())) requestHostSync();
          if (!gotAuthSnapshot && !shopHasCards(me())) ensureLocalShopVisible();
        }, ms);
      });
    }

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
    $('tft-howto')?.classList.add('hidden');
    $('tft-augment-pick')?.classList.add('hidden');
    state = null;
    match = null;
    ctx = null;
    if (hideUi) $('tft-game-screen')?.classList.add('hidden');
  }

  function applyForfeit(loserSlot) {
    if (!active || !state) return;
    const loser = Number(loserSlot);
    if (!Number.isFinite(loser) || !state.players[loser]) return;
    state.players[loser].hp = 0;
    const living = alivePlayers();
    if (living.length <= 1) endMatch(living[0]?.id ?? (loser === 0 ? 1 : 0));
    else {
      pushMsg(`${state.players[loser].name} forfeited.`);
      renderHud();
      if (isAuthority()) publishAuthState(true);
    }
  }

  window.TFT_ONLINE = {
    start,
    cleanup,
    handleRemote: (from, action) => {
      if (!active) return false;
      return applyRemoteAction(from, action);
    },
    applyAuthState,
    applyForfeit,
    isActive: () => active,
    isAuthority: () => isAuthority(),
  };
})();
