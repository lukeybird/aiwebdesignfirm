/* Live PvP army rules — loaded before main game script */
window.LIVE_ARMY = (function () {
  const FARM_SIZE = 44;
  const STRUCTURE_SIZE = 44;
  const COMBAT_TOWER_SIZE = 22;
  const MINT_SIZE = 16;

  const UNIT_UNLOCK = { tank: 1, speed: 2, striker: 3, sniper: 4, goblin: 2, peka: 5 };
  const UNIT_LABELS = {
    tank: 'Tank', speed: 'Speed', striker: 'Knight', sniper: 'Sniper', goblin: 'Goblin', peka: 'PEKA',
  };

  let active = false;

  function freshBarracks() {
    return { built: false, unitTier: 0, secret: { striker: 0, tank: 0, speed: 0, sniper: 0, goblin: 0, peka: 0 } };
  }

  function freshEngineers() {
    return { built: false, damage: 0, range: 0, health: 0, knockback: 0 };
  }

  function freshMissileUpgrades() {
    return { rate: 1, damage: 1, radius: 1 };
  }

  function onBattleStart(players, gameRules) {
    active = true;
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
      p.liveArmy = { barracks: freshBarracks(), engineers: freshEngineers() };
    }
    syncBuildToolbar();
  }

  function onBattleEnd() {
    active = false;
    syncBuildToolbar();
  }

  function isActive() {
    return active;
  }

  function initPlayer(p) {
    if (!p.liveArmy) p.liveArmy = { barracks: freshBarracks(), engineers: freshEngineers() };
  }

  function getTowerFootprint(t) {
    const type = t.towerType;
    if (type === 'farm' || type === 'barracks' || type === 'engineers' || type === 'missile') return STRUCTURE_SIZE;
    if (type === 'mint') return MINT_SIZE;
    if (type === 'turret' || type === 'laser' || type === 'spread') return COMBAT_TOWER_SIZE;
    return t.size || COMBAT_TOWER_SIZE;
  }

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
    else if (type === 'spread') { d.size = COMBAT_TOWER_SIZE; d.knockback = 24; d.name = 'Spreader'; }
    else if (type === 'turret') { d.size = COMBAT_TOWER_SIZE; d.hp = 140; d.damage = 24; d.name = 'Cannon'; }

    if (ownerId != null && type !== 'farm' && type !== 'mint' && type !== 'barracks' && type !== 'engineers') {
      const eng = playersRef?.[ownerId]?.liveArmy?.engineers;
      if (eng?.built) {
        d.damage = (d.damage || d.pelletDamage || 0) * (1 + eng.damage * 0.18);
        if (d.pelletDamage) d.pelletDamage = d.pelletDamage * (1 + eng.damage * 0.18);
        d.range = (d.range || 160) * (1 + eng.range * 0.1);
        d.hp = (d.hp || 80) * (1 + eng.health * 0.15);
        if (type === 'spread') d.knockback = (d.knockback || 24) * (1 + eng.knockback * 0.12);
      }
    }
    return d;
  }

  let playersRef = null;
  function setPlayersRef(players) { playersRef = players; }

  function secretLevel(pid, type) {
    return playersRef?.[pid]?.liveArmy?.barracks?.secret?.[type] || 0;
  }

  function modifyUnitDef(type, ut, pid) {
    if (!active) return ut;
    const u = { ...ut };
    const sec = secretLevel(pid, type);
    if (type === 'striker') {
      u.name = 'Knight';
      u.speed = 92 + sec * 6;
      u.behavior = 'knight';
      u.prefersUnits = true;
      u.damage = 24 + sec * 8;
      u.hp = 75 + sec * 25;
    } else if (type === 'goblin') {
      u.name = 'Goblin';
      u.speed = 145 + sec * 8;
      u.behavior = 'goblin';
      u.hp = 42 + sec * 10;
      u.damage = 11 + sec * 3;
      u.cost = 22;
      u.size = 14;
      u.targetsUnits = false;
      u.targetsTowers = true;
      u.targetsBase = false;
    } else if (type === 'tank') {
      u.hp = 205 + sec * 35;
      u.damage = 16 + sec * 4;
    } else if (type === 'speed') {
      u.speed = 112 + sec * 7;
      u.damage = 17 + sec * 3;
      u.hp = 58 + sec * 8;
    } else if (type === 'sniper') {
      u.damage = 24 + sec * 6;
      u.range = 198 + sec * 18;
      u.hp = 62 + sec * 10;
    } else if (type === 'peka') {
      u.hp = 550 + sec * 60;
      u.damage = 44 + sec * 8;
    }
    return u;
  }

  function hasBarracks(p) {
    return p.turrets.some(t => t.towerType === 'barracks' && t.hp > 0);
  }

  function unitUnlocked(p, type) {
    if (!active) return true;
    if (!hasBarracks(p)) return false;
    const tier = p.liveArmy?.barracks?.unitTier || 0;
    return tier >= (UNIT_UNLOCK[type] || 99);
  }

  function canDeployUnit(p, type) {
    if (!active) return true;
    return unitUnlocked(p, type);
  }

  function canPlaceStructure(p, towerType) {
    if (!active) return true;
    if (towerType === 'barracks') {
      const n = p.turrets.filter(t => t.towerType === 'barracks' && t.hp > 0).length;
      return n < 1;
    }
    if (towerType === 'engineers') {
      const n = p.turrets.filter(t => t.towerType === 'engineers' && t.hp > 0).length;
      return n < 1;
    }
    return true;
  }

  function farmIncomeScale(combatTime) {
    if (!active) return 1;
    return 1 / (1 + combatTime / 100);
  }

  function spreadKnockback(def, unit, pellet) {
    let kb = def.knockback || 24;
    if (unit.type === 'peka') kb *= 0.06;
    const spd = Math.hypot(pellet.vx, pellet.vy) || 1;
    return { nx: pellet.vx / spd, ny: pellet.vy / spd, kb };
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
    const up = t.missileUpgrades || freshMissileUpgrades();
    const eng = playersRef?.[ownerId]?.liveArmy?.engineers;
    const dmgMult = 1 + (up.damage - 1) * 0.35 + (eng?.damage || 0) * 0.1;
    return {
      fireInterval: 9 / (0.55 + up.rate * 0.45),
      damage: 4 * dmgMult,
      blastRadius: 72 + (up.radius - 1) * 28,
      missileSpeed: 260 + up.rate * 40,
    };
  }

  function sanitizeSnapshotForOpponent(state, viewerPid) {
    if (!active || !state?.players) return state;
    const enemy = viewerPid === 0 ? 1 : 0;
    const ep = state.players[enemy];
    if (!ep) return state;
    if (ep.liveArmy) {
      ep.liveArmy = {
        barracks: {
          built: !!ep.liveArmy.barracks?.built,
          unitTier: ep.liveArmy.barracks?.unitTier || 0,
          secret: {},
        },
        engineers: {
          built: !!ep.liveArmy.engineers?.built,
          damage: 0,
          range: 0,
          health: 0,
          knockback: 0,
        },
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
    const goblinBtn = document.getElementById('btn-goblin-live');
    const barracksBtn = document.getElementById('btn-barracks-live');
    const engineersBtn = document.getElementById('btn-engineers-live');
    if (strikerBtn && strikerBtn.childNodes[0]?.nodeType === 3) {
      strikerBtn.childNodes[0].textContent = active ? '🐴 Knight' : '🟥 Striker';
    } else if (strikerBtn) {
      const label = strikerBtn.childNodes[0];
      if (label) label.textContent = active ? '🐴 Knight' : '🟥 Striker';
    }
    if (bloopBtn) bloopBtn.style.display = active ? 'none' : '';
    if (laserBtn && active) laserBtn.childNodes[0].textContent = '⚡ Rail Gun';
    if (goblinBtn) goblinBtn.style.display = active ? '' : 'none';
    if (barracksBtn) barracksBtn.style.display = active ? '' : 'none';
    if (engineersBtn) engineersBtn.style.display = active ? '' : 'none';
  }

  return {
    isActive,
    onBattleStart,
    onBattleEnd,
    initPlayer,
    setPlayersRef,
    getTowerFootprint,
    modifyTowerDef,
    modifyUnitDef,
    hasBarracks,
    unitUnlocked,
    canDeployUnit,
    canPlaceStructure,
    farmIncomeScale,
    spreadKnockback,
    decorateTower,
    missileStats,
    sanitizeSnapshotForOpponent,
    freshMissileUpgrades,
    freshBarracks,
    freshEngineers,
    UNIT_UNLOCK,
    UNIT_LABELS,
    STRUCTURE_SIZE,
    FARM_SIZE,
  };
})();
