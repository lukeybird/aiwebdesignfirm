/* Live army rules — loaded before main game script */
window.LIVE_ARMY = (function () {
  const FARM_SIZE = 44;
  const STRUCTURE_SIZE = 44;
  const COMBAT_TOWER_SIZE = 22;
  const MINT_SIZE = 16;

  const COMBAT_TOWERS = ['turret', 'laser', 'spread', 'missile'];
  const ECON_TOWERS = ['farm', 'mint'];
  const UNIT_ORDER = ['tank', 'speed', 'goblin', 'striker', 'sniper', 'peka'];
  const UNIT_LABELS = {
    tank: 'Tank', speed: 'Wolf', striker: 'Knight', sniper: 'Sniper', goblin: 'Goblin', peka: 'PEKA',
  };
  const UNIT_UNLOCK_COST = {
    tank: 145, speed: 115, striker: 155, sniper: 190, goblin: 170, peka: 550,
  };
  const STAT_BRANCHES = ['speed', 'damage', 'health'];
  const STAT_MAX = 5;
  const ENGINEER_BRANCHES = ['damage', 'range', 'health', 'knockback'];
  const ENGINEER_BRANCH_LABELS = { damage: 'Damage', range: 'Range', health: 'Health', knockback: 'Knockback' };
  const ENGINEER_BRANCH_ICONS = { damage: '⚔️', range: '🎯', health: '🛡️', knockback: '💨' };
  const ENGINEER_STAT_MAX = 3;
  // Per-level tower upgrade strength (each branch caps at ENGINEER_STAT_MAX).
  const ENG_DAMAGE_PER_LVL = 0.30; // +90% damage at max
  const ENG_FIRERATE_PER_LVL = 0.12; // +36% fire rate at max (rides the damage branch)
  const ENG_RANGE_PER_LVL = 0.18; // +54% range at max
  const ENG_HEALTH_PER_LVL = 0.30; // +90% hp at max
  // Spreader knockback ramps from near-nothing to a strong shove only when the
  // knockback branch is fully upgraded.
  const SPREAD_KB_WEAK = 3;
  const SPREAD_KB_STRONG = 26;
  const TOWER_LABELS = {
    turret: 'Cannon', laser: 'Rail Gun', spread: 'Spreader', missile: 'Missile',
  };
  const TOWER_UNLOCK_COST = {
    turret: 125, laser: 165, spread: 145, missile: 220,
  };

  function freshTowerRecord() {
    return { unlocked: false, damage: 0, range: 0, health: 0, knockback: 0 };
  }

  function normalizeTowerRecord(rec) {
    if (!rec) return freshTowerRecord();
    return {
      unlocked: !!rec.unlocked,
      damage: rec.damage || 0,
      range: rec.range || 0,
      health: rec.health || 0,
      knockback: rec.knockback || 0,
    };
  }

  function normalizeEngineers(eng) {
    if (!eng) return freshEngineers();
    if (eng.towers) {
      eng.built = !!eng.built;
      for (const tt of COMBAT_TOWERS) {
        eng.towers[tt] = normalizeTowerRecord(eng.towers[tt]);
      }
      return eng;
    }
    const towers = {};
    for (const tt of COMBAT_TOWERS) towers[tt] = freshTowerRecord();
    return { built: !!eng.built, towers };
  }

  let active = false;
  let pvpMode = false;
  let playersRef = null;

  function freshUnitRecord() {
    return { unlocked: false, speed: 0, damage: 0, health: 0 };
  }

  function freshBarracks() {
    const units = {};
    for (const ut of UNIT_ORDER) units[ut] = freshUnitRecord();
    return { built: false, units };
  }

  function freshEngineers() {
    const towers = {};
    for (const tt of COMBAT_TOWERS) towers[tt] = freshTowerRecord();
    return { built: false, towers };
  }

  function freshEconomy() {
    return {
      farm: { unlocked: false, speed: 0, yield: 0 },
      mint: { unlocked: false, speed: 0, yield: 0 },
      base: { income: 0, health: 0, defense: 0 },
      farmAcc: 0,
      mintAcc: 0,
    };
  }

  const ECON_UNLOCK_COST = { farm: 140, mint: 235 };
  const ECON_BRANCH_MAX = 3;
  const ECON_BRANCH_COSTS = [300, 600, 1200];
  const HARVEST_BASE_INTERVAL = 4;
  const YIELD_START = 1;
  const YIELD_MAX = 4;

  function normalizeEcoBuilding(rec) {
    if (!rec) return { unlocked: false, speed: 0, yield: 0 };
    if (rec.speed == null) rec.speed = 0;
    if (rec.yield == null) rec.yield = 0;
    if (rec.unlocked && !rec.yieldCoinAmount) {
      rec.yield = Math.min(YIELD_MAX, (rec.yield || 0) + YIELD_START);
      rec.yieldCoinAmount = true;
    }
    if (rec.unlocked && rec.yield < YIELD_START) rec.yield = YIELD_START;
    return rec;
  }
  const BASE_BRANCH_MAX = { income: 3, health: 3, defense: 3 };
  const BASE_BRANCHES = ['income', 'health', 'defense'];
  const BASE_BRANCH_LABELS = { income: 'Income', health: 'Health', defense: 'Guns' };
  const BASE_BRANCH_ICONS = { income: '🪙', health: '❤️', defense: '🔫' };

  function freshMissileUpgrades() {
    return { rate: 1, damage: 1, radius: 1 };
  }

  function engineersRecord(p) {
    if (!p.liveArmy) p.liveArmy = { barracks: freshBarracks(), engineers: freshEngineers(), economy: freshEconomy() };
    p.liveArmy.engineers = normalizeEngineers(p.liveArmy.engineers);
    return p.liveArmy.engineers;
  }

  function towerRecord(p, type) {
    const eng = engineersRecord(p);
    if (!eng.towers[type]) eng.towers[type] = freshTowerRecord();
    return eng.towers[type];
  }

  function unitRecord(p, type) {
    if (!p.liveArmy?.barracks?.units?.[type]) {
      if (!p.liveArmy) p.liveArmy = { barracks: freshBarracks(), engineers: freshEngineers(), economy: freshEconomy() };
      if (!p.liveArmy.barracks.units) p.liveArmy.barracks.units = {};
      if (!p.liveArmy.barracks.units[type]) p.liveArmy.barracks.units[type] = freshUnitRecord();
    }
    return p.liveArmy.barracks.units[type];
  }

  function economyRecord(p) {
    if (!p.liveArmy) p.liveArmy = { barracks: freshBarracks(), engineers: freshEngineers(), economy: freshEconomy() };
    if (!p.liveArmy.economy) p.liveArmy.economy = freshEconomy();
    const eco = p.liveArmy.economy;
    eco.farm = normalizeEcoBuilding(eco.farm);
    eco.mint = normalizeEcoBuilding(eco.mint);
    if (eco.farmAcc == null) eco.farmAcc = 0;
    if (eco.mintAcc == null) eco.mintAcc = 0;
    return eco;
  }

  function onBattleStart(players, gameRules, opts) {
    active = true;
    pvpMode = !!(opts && opts.pvp);
    gameRules.units.bloop = false;
    gameRules.towers.laser = true;
    gameRules.towers.spread = true;
    gameRules.towers.turret = true;
    gameRules.towers.missile = true;
    gameRules.towers.mint = true;
    gameRules.towers.farm = true;
    gameRules.towers.barracks = true;
    gameRules.towers.engineers = true;
    gameRules.units.goblin = true;
    for (const p of players) {
      p.liveArmy = { barracks: freshBarracks(), engineers: freshEngineers(), economy: freshEconomy() };
    }
    syncBuildToolbar();
    syncBarracksPanelCopy();
    syncEngineersPanelCopy();
    syncEconomyPanelCopy();
  }

  function onBattleEnd() {
    active = false;
    pvpMode = false;
    syncBuildToolbar();
  }

  function isActive() { return active; }
  function isPvpMode() { return active && pvpMode; }

  function syncBarracksPanelCopy() {
    const el = document.getElementById('barracks-upgrade-desc');
    if (!el) return;
    el.textContent = pvpMode
      ? 'Grow each unit down its skill tree. Deeper tiers cost more. Stat levels are hidden from your opponent.'
      : 'Unlock units in the top row, then climb the small Speed, Attack, and Health tracks below each type.';
  }

  function syncEngineersPanelCopy() {
    const el = document.getElementById('engineers-upgrade-desc');
    if (!el) return;
    el.textContent = pvpMode
      ? 'Unlock each tower type, then upgrade damage, range, health, and knockback. Deeper tiers cost more — levels are hidden.'
      : 'Unlock each tower at the top of its column, then climb damage, range, health, and knockback branches.';
  }

  function syncEconomyPanelCopy() {
    const el = document.getElementById('economy-upgrade-desc');
    if (!el) return;
    el.textContent = pvpMode
      ? 'Unlock farms and mints, then upgrade harvest speed and yield on separate branches. Enemy levels are hidden.'
      : 'Unlock Farm or Mint at the top, then upgrade harvest speed (4s→1s) and coins per harvest (1→4) on separate branches.';
  }

  function initPlayer(p) {
    if (!p.liveArmy) p.liveArmy = { barracks: freshBarracks(), engineers: freshEngineers(), economy: freshEconomy() };
    if (!p.liveArmy.economy) p.liveArmy.economy = freshEconomy();
    if (!p.liveArmy.barracks) p.liveArmy.barracks = freshBarracks();
    p.liveArmy.engineers = normalizeEngineers(p.liveArmy.engineers);
    economyRecord(p);
    for (const ut of UNIT_ORDER) unitRecord(p, ut);
    for (const tt of COMBAT_TOWERS) towerRecord(p, tt);
  }

  function setPlayersRef(players) { playersRef = players; }

  function getTowerFootprint(t) {
    const type = t.towerType || t;
    if (type === 'farm' || type === 'barracks' || type === 'engineers' || type === 'missile') return STRUCTURE_SIZE;
    if (type === 'mint') return MINT_SIZE;
    if (type === 'turret' || type === 'laser' || type === 'spread') return COMBAT_TOWER_SIZE;
    return t.size || COMBAT_TOWER_SIZE;
  }

  function getPlacementCollisionRadius(towerType) {
    const type = towerType?.towerType || towerType;
    if (type === 'farm') return Math.ceil(FARM_SIZE / 2) + 4;
    if (type === 'barracks' || type === 'engineers' || type === 'missile') return 26;
    if (type === 'mint') return 12;
    if (type === 'turret' || type === 'laser' || type === 'spread') return 14;
    return 18;
  }

  const FARM_SEPARATION_GAP = 10;

  function modifyTowerDef(type, def, ownerId) {
    if (!active) return def;
    const d = { ...def };
    if (type === 'farm') { d.size = FARM_SIZE; d.name = 'Farm'; d.style = 'farm_live'; }
    else if (type === 'mint') { d.size = MINT_SIZE; d.name = 'Bank'; d.style = 'mint_live'; }
    else if (type === 'barracks') { d.size = STRUCTURE_SIZE; d.name = 'Barracks'; d.style = 'barracks'; d.cost = 180; d.hp = 120; }
    else if (type === 'engineers') { d.size = STRUCTURE_SIZE; d.name = 'Engineers'; d.style = 'engineers'; d.cost = 210; d.hp = 110; }
    else if (type === 'missile') {
      d.size = STRUCTURE_SIZE; d.name = 'Missile Base'; d.style = 'missile_live';
      d.fireInterval = 9; d.damage = 4; d.blastRadius = 72; d.missileSpeed = 260;
    }
    else if (type === 'laser') { d.size = COMBAT_TOWER_SIZE; d.name = 'Rail Gun'; d.style = 'railgun'; d.color = '#EAB308'; d.accent = '#CA8A04'; }
    else if (type === 'spread') { d.size = COMBAT_TOWER_SIZE; d.knockback = SPREAD_KB_WEAK; d.name = 'Spreader'; }
    else if (type === 'turret') { d.size = COMBAT_TOWER_SIZE; d.hp = 140; d.damage = 24; d.name = 'Cannon'; }

    if (ownerId != null && COMBAT_TOWERS.includes(type) && playersRef?.[ownerId]) {
      const rec = towerRecord(playersRef[ownerId], type);
      if (rec.unlocked) {
        const max = ENGINEER_STAT_MAX;
        const dmgLvl = Math.min(rec.damage || 0, max);
        const rngLvl = Math.min(rec.range || 0, max);
        const hpLvl = Math.min(rec.health || 0, max);
        const kbLvl = Math.min(rec.knockback || 0, max);
        const dmgMult = 1 + dmgLvl * ENG_DAMAGE_PER_LVL;
        d.damage = (d.damage || d.pelletDamage || 0) * dmgMult;
        if (d.pelletDamage) d.pelletDamage *= dmgMult;
        d.range = (d.range || 160) * (1 + rngLvl * ENG_RANGE_PER_LVL);
        d.hp = (d.hp || 80) * (1 + hpLvl * ENG_HEALTH_PER_LVL);
        d.fireRate = (d.fireRate || 1) * (1 + dmgLvl * ENG_FIRERATE_PER_LVL);
        if (type === 'spread') {
          d.knockback = SPREAD_KB_WEAK + (SPREAD_KB_STRONG - SPREAD_KB_WEAK) * (kbLvl / max);
        }
      }
    }
    return d;
  }

  function applyStatBonuses(u, type, pid) {
    const rec = playersRef?.[pid]?.liveArmy?.barracks?.units?.[type];
    if (!rec) return;
    const spd = rec.speed || 0;
    const dmg = rec.damage || 0;
    const hp = rec.health || 0;
    if (type === 'tank') {
      u.hp = (u.hp || 205) + hp * 35;
      u.damage = (u.damage || 16) + dmg * 4;
      u.speed = (u.speed || 50) + spd * 5;
    } else if (type === 'speed') {
      u.speed = (u.speed || 112) + spd * 7;
      u.damage = (u.damage || 17) + dmg * 3;
      u.hp = (u.hp || 58) + hp * 8;
    } else if (type === 'striker') {
      u.name = 'Knight';
      u.behavior = 'knight';
      u.prefersUnits = true;
      u.speed = (u.speed || 92) + spd * 6;
      u.damage = (u.damage || 24) + dmg * 8;
      u.hp = (u.hp || 75) + hp * 25;
    } else if (type === 'sniper') {
      u.damage = (u.damage || 24) + dmg * 6;
      u.range = (u.range || 198) + spd * 18;
      u.hp = (u.hp || 62) + hp * 10;
    } else if (type === 'peka') {
      u.hp = (u.hp || 550) + hp * 60;
      u.damage = (u.damage || 44) + dmg * 8;
      u.speed = (u.speed || 28) + spd * 3;
    } else if (type === 'goblin') {
      u.name = 'Goblin';
      u.behavior = 'goblin';
      u.speed = (u.speed || 145) + spd * 8;
      u.hp = (u.hp || 42) + hp * 10;
      u.damage = (u.damage || 11) + dmg * 3;
      u.cost = 22;
      u.size = 14;
      u.targetsUnits = false;
      u.targetsTowers = true;
      u.targetsBase = false;
      u.immuneRailgun = true;
      u.lootMult = 1 + dmg * 0.35;
    }
  }

  function modifyUnitDef(type, ut, pid) {
    if (!active) return ut;
    const u = { ...ut };
    applyStatBonuses(u, type, pid);
    return u;
  }

  function hasBarracks(p) {
    return p.turrets.some(t => t.towerType === 'barracks' && t.hp > 0);
  }

  function hasEngineers(p) {
    return p.turrets.some(t => t.towerType === 'engineers' && t.hp > 0);
  }

  function unitUnlocked(p, type) {
    if (!active) return true;
    if (!hasBarracks(p)) return false;
    return !!p.liveArmy?.barracks?.units?.[type]?.unlocked;
  }

  function canDeployUnit(p, type) {
    if (!active) return true;
    return unitUnlocked(p, type);
  }

  function unitUnlockCost(type) {
    return UNIT_UNLOCK_COST[type] || 99;
  }

  function statUpgradeCost(p, type, stat) {
    const rec = unitRecord(p, type);
    const lvl = rec[stat] || 0;
    return Math.floor(65 * Math.pow(1.68, lvl) + lvl * 25);
  }

  function towerUnlocked(p, type) {
    if (!active) return true;
    if (!COMBAT_TOWERS.includes(type)) return true;
    if (!hasEngineers(p)) return false;
    return !!towerRecord(p, type).unlocked;
  }

  function canPlaceCombatTower(p, towerType) {
    if (!active) return true;
    return hasEngineers(p) && towerUnlocked(p, towerType);
  }

  function towerUnlockCost(type) {
    return TOWER_UNLOCK_COST[type] || 150;
  }

  function engineersUpgradeCost(p, towerType, branch) {
    const rec = towerRecord(p, towerType);
    const lvl = rec[branch] || 0;
    return Math.floor(75 * Math.pow(1.68, lvl) + lvl * 30);
  }

  function economyUnlockCost(type) {
    return ECON_UNLOCK_COST[type] || 150;
  }

  function economyBranchCost(lvl) {
    if (lvl >= ECON_BRANCH_MAX) return null;
    return ECON_BRANCH_COSTS[lvl] ?? null;
  }

  function economySpeedCost(p, type) {
    const eco = economyRecord(p);
    const rec = type === 'farm' ? eco.farm : eco.mint;
    return economyBranchCost(rec.speed || 0);
  }

  function economyYieldCost(p, type) {
    const eco = economyRecord(p);
    const rec = type === 'farm' ? eco.farm : eco.mint;
    const upgradeTier = Math.max(0, (rec.yield || YIELD_START) - YIELD_START);
    return economyBranchCost(upgradeTier);
  }

  function harvestInterval(p, type) {
    const eco = economyRecord(p);
    const rec = type === 'farm' ? eco.farm : eco.mint;
    if (!rec.unlocked) return HARVEST_BASE_INTERVAL;
    return Math.max(1, HARVEST_BASE_INTERVAL - (rec.speed || 0));
  }

  function harvestAmount(p, type) {
    const eco = economyRecord(p);
    const rec = type === 'farm' ? eco.farm : eco.mint;
    if (!rec.unlocked) return 0;
    return Math.max(YIELD_START, rec.yield || YIELD_START);
  }

  function economyBaseCost(p, branch) {
    const eco = economyRecord(p);
    const lvl = eco.base[branch] || 0;
    const bases = { income: 58, health: 125, defense: 155 };
    return Math.floor((bases[branch] || 80) * Math.pow(1.72, lvl) + lvl * 35);
  }

  function farmUnlocked(p) {
    if (!active) return true;
    return !!economyRecord(p).farm.unlocked;
  }

  function mintUnlocked(p) {
    if (!active) return true;
    return !!economyRecord(p).mint.unlocked;
  }

  function yieldMax() {
    return YIELD_MAX;
  }

  function speedMax() {
    return ECON_BRANCH_MAX;
  }

  function baseBranchMax(branch) {
    return BASE_BRANCH_MAX[branch] || 0;
  }

  function economyIncomeLevel(p, type) {
    const eco = economyRecord(p);
    if (type === 'base') return 1 + (eco.base.income || 0);
    if (type === 'farm') return eco.farm.unlocked ? harvestAmount(p, 'farm') : 0;
    if (type === 'mint') return eco.mint.unlocked ? harvestAmount(p, 'mint') : 0;
    return 1;
  }

  function baseHealthBonus(p) {
    return (economyRecord(p).base.health || 0) * 150;
  }

  function baseDefenseLevel(p) {
    return economyRecord(p).base.defense || 0;
  }

  function canPlaceStructure(p, towerType) {
    if (!active) return true;
    if (towerType === 'farm') return farmUnlocked(p);
    if (towerType === 'mint') return mintUnlocked(p);
    if (towerType === 'barracks') {
      return p.turrets.filter(t => t.towerType === 'barracks' && t.hp > 0).length < 1;
    }
    if (towerType === 'engineers') {
      return p.turrets.filter(t => t.towerType === 'engineers' && t.hp > 0).length < 1;
    }
    if (COMBAT_TOWERS.includes(towerType)) {
      return canPlaceCombatTower(p, towerType);
    }
    return true;
  }

  function isBottomToolbarVisible(tool, p) {
    if (!active) return true;
    if (tool === 'move') return true;
    if (tool === 'farm') return farmUnlocked(p);
    if (tool === 'mint') return mintUnlocked(p);
    if (tool === 'barracks') return canPlaceStructure(p, 'barracks');
    if (tool === 'engineers') return canPlaceStructure(p, 'engineers');
    if (COMBAT_TOWERS.includes(tool)) return canPlaceCombatTower(p, tool);
    if (UNIT_LABELS[tool]) return unitUnlocked(p, tool);
    return false;
  }

  function farmIncomeScale(combatTime) {
    if (!active) return 1;
    return 1 / (1 + combatTime / 100);
  }

  function spreadKnockback(def, unit, pellet) {
    let kb = def.knockback != null ? def.knockback : SPREAD_KB_WEAK;
    if (unit.type === 'peka') kb *= 0.06;
    const spd = Math.hypot(pellet.vx, pellet.vy) || 1;
    return { nx: pellet.vx / spd, ny: pellet.vy / spd, kb };
  }

  function goblinLootMult(damageTier) {
    return 1 + (damageTier || 0) * 0.35;
  }

  function goblinLootPreview(damageTier, towerType) {
    const mult = goblinLootMult(damageTier);
    const base = towerType === 'mint' ? 10 : 4;
    const mintBonus = towerType === 'mint' ? 2.8 : 1;
    return Math.max(1, Math.floor(base * mult * mintBonus));
  }

  function goblinLootAmount(attacker, towerType) {
    const rec = playersRef?.[attacker.owner]?.liveArmy?.barracks?.units?.goblin;
    const dmgTier = rec?.damage || 0;
    return goblinLootPreview(dmgTier, towerType);
  }

  function decorateTower(t, ownerId) {
    if (!active) return t;
    if (t.towerType === 'missile' && !t.missileUpgrades) t.missileUpgrades = freshMissileUpgrades();
    if (t.towerType === 'barracks') playersRef[ownerId].liveArmy.barracks.built = true;
    if (t.towerType === 'engineers') playersRef[ownerId].liveArmy.engineers.built = true;
    const def = modifyTowerDef(t.towerType, { hp: 80, maxHp: 80 }, ownerId);
    t.hp = def.hp || t.hp;
    t.maxHp = t.hp;
    return t;
  }

  function missileStats(t, ownerId) {
    const rec = playersRef?.[ownerId] ? towerRecord(playersRef[ownerId], 'missile') : null;
    if (active && rec?.unlocked) {
      const dmg = rec.damage || 0;
      const rng = rec.range || 0;
      return {
        fireInterval: 9 / (0.55 + (1 + dmg * 0.08) * 0.45),
        damage: 4 * (1 + dmg * 0.35),
        blastRadius: 72 + rng * 28,
        missileSpeed: 260 + rng * 40,
      };
    }
    const up = t.missileUpgrades || freshMissileUpgrades();
    return {
      fireInterval: 9 / (0.55 + up.rate * 0.45),
      damage: 4 * (1 + (up.damage - 1) * 0.35),
      blastRadius: 72 + (up.radius - 1) * 28,
      missileSpeed: 260 + up.rate * 40,
    };
  }

  function sanitizeSnapshotForOpponent(state, viewerPid) {
    if (!active || !pvpMode || !state?.players) return state;
    const enemy = viewerPid === 0 ? 1 : 0;
    const ep = state.players[enemy];
    if (!ep) return state;
    if (ep.liveArmy?.barracks) {
      const units = {};
      for (const ut of UNIT_ORDER) {
        const rec = ep.liveArmy.barracks.units?.[ut];
        units[ut] = { unlocked: !!rec?.unlocked, speed: 0, damage: 0, health: 0 };
      }
      ep.liveArmy.barracks = { built: !!ep.liveArmy.barracks.built, units };
    }
    if (ep.liveArmy?.engineers) {
      const towers = {};
      for (const tt of COMBAT_TOWERS) {
        const rec = ep.liveArmy.engineers.towers?.[tt];
        towers[tt] = { unlocked: !!rec?.unlocked, damage: 0, range: 0, health: 0, knockback: 0 };
      }
      ep.liveArmy.engineers = { built: !!ep.liveArmy.engineers.built, towers };
    }
    if (ep.liveArmy?.economy) {
      ep.liveArmy.economy = {
        farm: { unlocked: !!ep.liveArmy.economy.farm?.unlocked, speed: 0, yield: 0 },
        mint: { unlocked: !!ep.liveArmy.economy.mint?.unlocked, speed: 0, yield: 0 },
        base: { income: 0, health: 0, defense: 0 },
        farmAcc: 0,
        mintAcc: 0,
      };
    }
    if (ep.turrets) {
      ep.turrets = ep.turrets.map((t) => {
        const c = { ...t };
        if (c.missileUpgrades) c.missileUpgrades = { rate: 1, damage: 1, radius: 1 };
        return c;
      });
    }
    return state;
  }

  function syncBuildToolbar() {
    const strikerBtn = document.querySelector('.btn-striker');
    const bloopBtn = document.querySelector('.btn-bloop');
    const laserBtn = document.querySelector('.btn-laser');
    if (strikerBtn && strikerBtn.childNodes[0]?.nodeType === 3) {
      strikerBtn.childNodes[0].textContent = active ? '🐴 Knight' : '🟥 Striker';
    } else if (strikerBtn) {
      const label = strikerBtn.childNodes[0];
      if (label) label.textContent = active ? '🐴 Knight' : '🟥 Striker';
    }
    if (bloopBtn) bloopBtn.style.display = active ? 'none' : '';
    if (laserBtn && active) laserBtn.childNodes[0].textContent = '⚡ Rail Gun';
  }

  return {
    isActive,
    isPvpMode,
    onBattleStart,
    onBattleEnd,
    syncBarracksPanelCopy,
    syncEngineersPanelCopy,
    syncEconomyPanelCopy,
    syncEngineersPanelCopy,
    initPlayer,
    setPlayersRef,
    getTowerFootprint,
    getPlacementCollisionRadius,
    modifyTowerDef,
    modifyUnitDef,
    hasBarracks,
    hasEngineers,
    towerUnlocked,
    canPlaceCombatTower,
    towerRecord,
    engineersRecord,
    towerUnlockCost,
    unitUnlocked,
    canDeployUnit,
    canPlaceStructure,
    isBottomToolbarVisible,
    unitUnlockCost,
    statUpgradeCost,
    engineersUpgradeCost,
    economyRecord,
    economyUnlockCost,
    economySpeedCost,
    economyYieldCost,
    economyBaseCost,
    farmUnlocked,
    mintUnlocked,
    yieldMax,
    speedMax,
    harvestInterval,
    harvestAmount,
    ECON_BRANCH_MAX,
    YIELD_START,
    YIELD_MAX,
    baseBranchMax,
    economyIncomeLevel,
    baseHealthBonus,
    baseDefenseLevel,
    unitRecord,
    goblinLootAmount,
    goblinLootPreview,
    goblinLootMult,
    farmIncomeScale,
    spreadKnockback,
    decorateTower,
    missileStats,
    sanitizeSnapshotForOpponent,
    syncBuildToolbar,
    freshMissileUpgrades,
    freshBarracks,
    freshEngineers,
    freshEconomy,
    COMBAT_TOWERS,
    TOWER_LABELS,
    TOWER_UNLOCK_COST,
    UNIT_ORDER,
    UNIT_LABELS,
    UNIT_UNLOCK_COST,
    STAT_BRANCHES,
    STAT_MAX,
    ENGINEER_BRANCHES,
    ENGINEER_BRANCH_LABELS,
    ENGINEER_BRANCH_ICONS,
    ENGINEER_STAT_MAX,
    ECON_UNLOCK_COST,
    ECON_BRANCH_COSTS,
    BASE_BRANCHES,
    BASE_BRANCH_LABELS,
    BASE_BRANCH_ICONS,
    BASE_BRANCH_MAX,
    STRUCTURE_SIZE,
    FARM_SIZE,
    FARM_SEPARATION_GAP,
  };
})();
