/* Live army rules — loaded before main game script */
window.LIVE_ARMY = (function () {
  const FARM_SIZE = 44;
  const STRUCTURE_SIZE = 44;
  const LABORATORY_SIZE = 36;
  const COMBAT_TOWER_SIZE = 22;
  const TURRET_SIZE = 34;
  const ARCHER_SIZE = 44; // ~2× a normal combat tower
  const MINT_SIZE = 16;

  const COMBAT_TOWERS = ['turret', 'laser', 'spread', 'archer', 'catapult'];
  const ECON_TOWERS = ['farm', 'mint'];
  const HERO_UNITS = ['wolf_hunter', 'angel', 'yeti', 'axoloti_king'];
  const UNIT_ORDER = ['wolf_hunter', 'angel', 'axoloti_king', 'axoloti', 'tank', 'speed', 'goblin', 'striker', 'swordsman', 'farmer', 'sniper', 'bowman', 'yeti', 'peka'];
  const UNIT_LABELS = {
    wolf_hunter: 'Hunter',
    angel: 'Angel',
    axoloti_king: 'Axoloti King',
    axoloti: 'Axoloti',
    tank: 'Elephant', speed: 'Wolf', striker: 'Knight', swordsman: 'Swordsman', farmer: 'Farmer', sniper: 'Sniper', bowman: 'Archer', goblin: 'Goblin', yeti: 'Yeti', peka: 'Dragon',
  };
  const UNIT_UNLOCK_COST = {
    wolf_hunter: 300,
    angel: 150,
    axoloti_king: 280,
    axoloti: 90,
    tank: 100, speed: 150, striker: 100, swordsman: 50, farmer: 200, sniper: 250, bowman: 50, goblin: 125, yeti: 250, peka: 500,
  };
  function isHeroUnit(type) {
    return HERO_UNITS.includes(type);
  }
  const STAT_BRANCHES = ['speed', 'damage', 'health'];
  const STAT_MAX = 3;
  const STAT_UPGRADE_COSTS = [150, 450, 1200];
  // Speed branch is half price (base stats = half of damage/health full potential).
  const STAT_SPEED_UPGRADE_COSTS = STAT_UPGRADE_COSTS.map((c) => Math.round(c / 2));
  // Tier 0 = starting power (half of full potential for damage/health).
  // Tiers 1–3 climb toward 2× (damage/health) or 1.5× (speed).
  const UNIT_DAMAGE_MULT = [1, 1.33, 1.67, 2];
  const UNIT_HEALTH_MULT = [1, 1.33, 1.67, 2];
  const UNIT_SPEED_MULT = [1, 1.15, 1.3, 1.5];
  const ENGINEER_BRANCHES = ['damage', 'range', 'health', 'knockback'];
  const TURRET_ENGINEER_BRANCHES = ['damage', 'firerate', 'range'];
  const ENGINEER_BRANCH_LABELS = { damage: 'Damage', range: 'Range', health: 'Health', knockback: 'Knockback', firerate: 'Fire Rate' };
  const ENGINEER_BRANCH_ICONS = { damage: '⚔️', range: '🎯', health: '🛡️', knockback: '💨', firerate: '🔥' };
  const ENGINEER_STAT_MAX = 3;
  const ENGINEER_UPGRADE_COSTS = [150, 300, 600];
  // Cannon-specific upgrade curves (tier 1/2/3 = index 1/2/3; index 0 = no upgrade).
  const CANNON_DAMAGE_MULT = [1, 2, 3, 4];
  const CANNON_FIRERATE_MULT = [1, 2, 3, 4];
  const CANNON_RANGE_MULT = [1, 1.3, 1.6, 2];
  // Per-level tower upgrade strength (each branch caps at ENGINEER_STAT_MAX).
  const ENG_DAMAGE_PER_LVL = 0.30; // +90% damage at max
  const ENG_FIRERATE_PER_LVL = 0.12; // +36% fire rate at max (rides the damage branch)
  const ENG_RANGE_PER_LVL = 0.18; // +54% range at max
  const ENG_RAIL_RANGE_PER_LVL = 0.55; // Rail Gun range climbs hard: +165% at max
  const ENG_HEALTH_PER_LVL = 0.30; // +90% hp at max
  // Spreader knockback ramps from near-nothing to a strong shove only when the
  // knockback branch is fully upgraded.
  const SPREAD_KB_WEAK = 0.5;
  const SPREAD_KB_STRONG = 4;
  const TOWER_LABELS = {
    turret: 'Turret', laser: 'Rail Gun', spread: 'Spreader', missile: 'Missile', archer: 'Archer Tower', catapult: 'Catapult',
  };
  const TOWER_UNLOCK_COST = {
    turret: 125, laser: 165, spread: 145, missile: 220, archer: 185, catapult: 175,
  };

  function freshTowerRecord() {
    return { unlocked: false, damage: 0, range: 0, health: 0, knockback: 0, firerate: 0 };
  }

  const ENGINEER_STAT_KEYS = ['damage', 'firerate', 'range', 'health', 'knockback'];

  // Normalize IN PLACE so the record keeps its object identity. Callers capture
  // a reference to this object and mutate it (e.g. buying an upgrade); returning
  // a fresh copy here would silently orphan those writes.
  function normalizeTowerRecord(rec) {
    if (!rec) return freshTowerRecord();
    rec.unlocked = !!rec.unlocked;
    // Global Tower Depot mastery trees were removed — keep unlock only.
    rec.damage = 0;
    rec.range = 0;
    rec.health = 0;
    rec.knockback = 0;
    rec.firerate = 0;
    return rec;
  }

  function mergeTowerRecord(target, source) {
    const out = normalizeTowerRecord(target);
    const src = normalizeTowerRecord(source);
    out.unlocked = out.unlocked || src.unlocked;
    return out;
  }

  function migrateEngineerTowerRecords(eng) {
    if (!eng?.towers) return;
    for (const strayKey of Object.keys(eng.towers)) {
      if (COMBAT_TOWERS.includes(strayKey)) continue;
      const stray = eng.towers[strayKey];
      if (!stray) {
        delete eng.towers[strayKey];
        continue;
      }
      // Recover upgrades that were saved under a bad key (e.g. undefined tower type).
      eng.towers.turret = mergeTowerRecord(eng.towers.turret, stray);
      delete eng.towers[strayKey];
    }
  }

  function normalizeEngineers(eng) {
    if (!eng) return freshEngineers();
    if (eng.towers) {
      eng.built = !!eng.built;
      migrateEngineerTowerRecords(eng);
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
    return { unlocked: false, speed: 0, damage: 0, health: 0, skills: {} };
  }

  /**
   * Branching barracks skill trees (Knight-style layout).
   * Each finished tree adds +1.0 total to ATK / HP / SPD → 2× base. AS never scales.
   * Sniper & Archer Speed nodes also grow Range (via applyStatBonuses).
   * Goblin Damage nodes also grow loot (dmgMult → lootMult).
   */
  const BRANCH_THIRD = 1 / 3;
  const BRANCH_COSTS = {
    a: 250, b: 200, mid: 500, c: 550, d: 550, fin: 950,
  }; // 3000 total — same economy as Knight

  function mkBranchSkill(id, label, costKey, requires, effects, blurb, art) {
    return {
      id,
      label,
      cost: BRANCH_COSTS[costKey],
      requires,
      effects,
      blurb,
      ...(art.icon ? { icon: art.icon } : {}),
      ...(art.glyph ? { glyph: art.glyph } : {}),
    };
  }

  function mkStandardBranchTree(defs) {
    // defs: { a, b, mid, c, d, fin } each { id, label, effects, blurb, icon?, glyph? }
    const a = mkBranchSkill(defs.a.id, defs.a.label, 'a', [], defs.a.effects, defs.a.blurb, defs.a);
    const b = mkBranchSkill(defs.b.id, defs.b.label, 'b', [], defs.b.effects, defs.b.blurb, defs.b);
    const mid = mkBranchSkill(defs.mid.id, defs.mid.label, 'mid', [defs.a.id, defs.b.id], defs.mid.effects, defs.mid.blurb, defs.mid);
    const c = mkBranchSkill(defs.c.id, defs.c.label, 'c', [defs.mid.id], defs.c.effects, defs.c.blurb, defs.c);
    const d = mkBranchSkill(defs.d.id, defs.d.label, 'd', [defs.mid.id], defs.d.effects, defs.d.blurb, defs.d);
    const fin = mkBranchSkill(defs.fin.id, defs.fin.label, 'fin', [defs.c.id, defs.d.id], defs.fin.effects, defs.fin.blurb, defs.fin);
    const skills = { [a.id]: a, [b.id]: b, [mid.id]: mid, [c.id]: c, [d.id]: d, [fin.id]: fin };
    return {
      order: [a.id, b.id, mid.id, c.id, d.id, fin.id],
      skills,
      layout: {
        split1: [a.id, b.id],
        mid: mid.id,
        split2: [c.id, d.id],
        final: fin.id,
      },
    };
  }

  const UNIT_SKILL_TREES = {
    striker: mkStandardBranchTree({
      a: {
        id: 'sharper_steel', label: 'Sharper Steel',
        effects: { damage: BRANCH_THIRD }, blurb: '+⅓× Attack',
        icon: '/TDG/portraits/skill-sharper-steel.webp',
      },
      b: {
        id: 'lighter_boots', label: 'Lighter Boots',
        effects: { speed: BRANCH_THIRD }, blurb: '+⅓× Speed',
        icon: '/TDG/portraits/skill-lighter-boots.webp',
      },
      mid: {
        id: 'fitted_armour', label: 'Fitted Armour',
        effects: { health: BRANCH_THIRD, speed: BRANCH_THIRD }, blurb: '+⅓× Health & Speed',
        icon: '/TDG/portraits/skill-fitted-armour.webp',
      },
      c: {
        id: 'tempered_blade', label: 'Tempered Blade',
        effects: { damage: BRANCH_THIRD }, blurb: '+⅓× Attack',
        icon: '/TDG/portraits/skill-tempered-blade.webp',
      },
      d: {
        id: 'tower_shield', label: 'Tower Shield',
        effects: { health: BRANCH_THIRD }, blurb: '+⅓× Health',
        icon: '/TDG/portraits/skill-tower-shield.webp',
      },
      fin: {
        id: 'champion_crest', label: 'Champion Crest',
        effects: { damage: BRANCH_THIRD, health: BRANCH_THIRD, speed: BRANCH_THIRD },
        blurb: '+⅓× Attack, Health & Speed — base stats ×2',
        icon: '/TDG/portraits/skill-champion-crest.webp',
      },
    }),

    tank: mkStandardBranchTree({
      a: { id: 'thick_hide', label: 'Thick Hide', effects: { health: BRANCH_THIRD }, blurb: '+⅓× Health', icon: '/TDG/portraits/skill-thick-hide.webp' },
      b: { id: 'pounding_gait', label: 'Pounding Gait', effects: { speed: BRANCH_THIRD }, blurb: '+⅓× Speed', icon: '/TDG/portraits/skill-pounding-gait.webp' },
      mid: { id: 'howdah_brace', label: 'Howdah Brace', effects: { health: BRANCH_THIRD, speed: BRANCH_THIRD }, blurb: '+⅓× Health & Speed', icon: '/TDG/portraits/skill-howdah-brace.webp' },
      c: { id: 'tusk_spikes', label: 'Tusk Spikes', effects: { damage: BRANCH_THIRD }, blurb: '+⅓× Attack', icon: '/TDG/portraits/skill-tusk-spikes.webp' },
      d: { id: 'iron_plating', label: 'Iron Plating', effects: { health: BRANCH_THIRD }, blurb: '+⅓× Health', icon: '/TDG/portraits/skill-iron-plating.webp' },
      fin: { id: 'war_mammoth', label: 'War Mammoth', effects: { damage: BRANCH_THIRD, health: BRANCH_THIRD, speed: BRANCH_THIRD }, blurb: '+⅓× Attack, Health & Speed — base stats ×2', icon: '/TDG/portraits/skill-war-mammoth.webp' },
    }),

    speed: mkStandardBranchTree({
      a: { id: 'razor_fangs', label: 'Razor Fangs', effects: { damage: BRANCH_THIRD }, blurb: '+⅓× Attack', icon: '/TDG/portraits/skill-razor-fangs.webp' },
      b: { id: 'pack_lungs', label: 'Pack Lungs', effects: { speed: BRANCH_THIRD }, blurb: '+⅓× Speed', icon: '/TDG/portraits/skill-pack-lungs.webp' },
      mid: { id: 'lean_muscle', label: 'Lean Muscle', effects: { health: BRANCH_THIRD, speed: BRANCH_THIRD }, blurb: '+⅓× Health & Speed', icon: '/TDG/portraits/skill-lean-muscle.webp' },
      c: { id: 'hunter_instinct', label: 'Hunter Instinct', effects: { damage: BRANCH_THIRD }, blurb: '+⅓× Attack', icon: '/TDG/portraits/skill-hunter-instinct.webp' },
      d: { id: 'thick_fur', label: 'Thick Fur', effects: { health: BRANCH_THIRD }, blurb: '+⅓× Health', icon: '/TDG/portraits/skill-thick-fur.webp' },
      fin: { id: 'alpha_howl', label: 'Alpha Howl', effects: { damage: BRANCH_THIRD, health: BRANCH_THIRD, speed: BRANCH_THIRD }, blurb: '+⅓× Attack, Health & Speed — base stats ×2', icon: '/TDG/portraits/skill-alpha-howl.webp' },
    }),

    goblin: mkStandardBranchTree({
      a: { id: 'sticky_fingers', label: 'Sticky Fingers', effects: { damage: BRANCH_THIRD }, blurb: '+⅓× Loot & Attack', icon: '/TDG/portraits/skill-sticky-fingers.webp' },
      b: { id: 'flea_boots', label: 'Flea Boots', effects: { speed: BRANCH_THIRD }, blurb: '+⅓× Speed', icon: '/TDG/portraits/skill-flea-boots.webp' },
      mid: { id: 'sack_of_spoils', label: 'Sack of Spoils', effects: { damage: BRANCH_THIRD, health: BRANCH_THIRD }, blurb: '+⅓× Loot & Health', icon: '/TDG/portraits/skill-sack-of-spoils.webp' },
      c: { id: 'crowbar', label: 'Crowbar', effects: { damage: BRANCH_THIRD }, blurb: '+⅓× Loot & Attack', icon: '/TDG/portraits/skill-crowbar.webp' },
      d: { id: 'scrap_armor', label: 'Scrap Armor', effects: { health: BRANCH_THIRD }, blurb: '+⅓× Health', icon: '/TDG/portraits/skill-scrap-armor.webp' },
      fin: { id: 'kingpin', label: 'Kingpin', effects: { damage: BRANCH_THIRD, health: BRANCH_THIRD, speed: BRANCH_THIRD }, blurb: '+⅓× Loot, Attack, Health & Speed — base ×2', icon: '/TDG/portraits/skill-kingpin.webp' },
    }),

    farmer: mkStandardBranchTree({
      a: { id: 'pitchfork_tip', label: 'Pitchfork Tip', effects: { damage: BRANCH_THIRD }, blurb: '+⅓× Attack', icon: '/TDG/portraits/skill-pitchfork-tip.webp' },
      b: { id: 'work_boots', label: 'Work Boots', effects: { speed: BRANCH_THIRD }, blurb: '+⅓× Speed', icon: '/TDG/portraits/skill-work-boots.webp' },
      mid: { id: 'harvest_heart', label: 'Harvest Heart', effects: { health: BRANCH_THIRD, speed: BRANCH_THIRD }, blurb: '+⅓× Health & Speed', icon: '/TDG/portraits/skill-harvest-heart.webp' },
      c: { id: 'thresher', label: 'Thresher', effects: { damage: BRANCH_THIRD }, blurb: '+⅓× Attack', icon: '/TDG/portraits/skill-thresher.webp' },
      d: { id: 'barn_coat', label: 'Barn Coat', effects: { health: BRANCH_THIRD }, blurb: '+⅓× Health', icon: '/TDG/portraits/skill-barn-coat.webp' },
      fin: { id: 'field_marshal', label: 'Field Marshal', effects: { damage: BRANCH_THIRD, health: BRANCH_THIRD, speed: BRANCH_THIRD }, blurb: '+⅓× Attack, Health & Speed — base stats ×2', icon: '/TDG/portraits/skill-field-marshal.webp' },
    }),

    sniper: mkStandardBranchTree({
      a: { id: 'hollow_points', label: 'Hollow Points', effects: { damage: BRANCH_THIRD }, blurb: '+⅓× Attack', icon: '/TDG/portraits/skill-hollow-points.webp' },
      b: { id: 'long_glass', label: 'Long Glass', effects: { speed: BRANCH_THIRD }, blurb: '+⅓× Range', icon: '/TDG/portraits/skill-long-glass.webp' },
      mid: { id: 'steady_breath', label: 'Steady Breath', effects: { health: BRANCH_THIRD, speed: BRANCH_THIRD }, blurb: '+⅓× Health & Range', icon: '/TDG/portraits/skill-steady-breath.webp' },
      c: { id: 'hot_loads', label: 'Hot Loads', effects: { damage: BRANCH_THIRD }, blurb: '+⅓× Attack', icon: '/TDG/portraits/skill-hot-loads.webp' },
      d: { id: 'ghillie', label: 'Ghillie', effects: { health: BRANCH_THIRD }, blurb: '+⅓× Health', icon: '/TDG/portraits/skill-ghillie.webp' },
      fin: { id: 'deadeye', label: 'Deadeye', effects: { damage: BRANCH_THIRD, health: BRANCH_THIRD, speed: BRANCH_THIRD }, blurb: '+⅓× Attack, Health & Range — base ×2', icon: '/TDG/portraits/skill-deadeye.webp' },
    }),

    bowman: mkStandardBranchTree({
      a: { id: 'barbed_heads', label: 'Barbed Heads', effects: { damage: BRANCH_THIRD }, blurb: '+⅓× Attack', icon: '/TDG/portraits/skill-barbed-heads.webp' },
      b: { id: 'draw_strength', label: 'Draw Strength', effects: { speed: BRANCH_THIRD }, blurb: '+⅓× Range', icon: '/TDG/portraits/skill-draw-strength.webp' },
      mid: { id: 'quiver_guard', label: 'Quiver Guard', effects: { health: BRANCH_THIRD, speed: BRANCH_THIRD }, blurb: '+⅓× Health & Range', icon: '/TDG/portraits/skill-quiver-guard.webp' },
      c: { id: 'bodkin', label: 'Bodkin', effects: { damage: BRANCH_THIRD }, blurb: '+⅓× Attack', icon: '/TDG/portraits/skill-bodkin.webp' },
      d: { id: 'leather_brace', label: 'Leather Brace', effects: { health: BRANCH_THIRD }, blurb: '+⅓× Health', icon: '/TDG/portraits/skill-leather-brace.webp' },
      fin: { id: 'eagle_eye', label: 'Eagle Eye', effects: { damage: BRANCH_THIRD, health: BRANCH_THIRD, speed: BRANCH_THIRD }, blurb: '+⅓× Attack, Health & Range — base ×2', icon: '/TDG/portraits/skill-eagle-eye.webp' },
    }),

    swordsman: mkStandardBranchTree({
      a: { id: 'honed_edge', label: 'Honed Edge', effects: { damage: BRANCH_THIRD }, blurb: '+⅓× Attack', icon: '/TDG/portraits/skill-honed-edge.webp' },
      b: { id: 'parade_step', label: 'Parade Step', effects: { speed: BRANCH_THIRD }, blurb: '+⅓× Speed', icon: '/TDG/portraits/skill-parade-step.webp' },
      mid: { id: 'polished_plate', label: 'Polished Plate', effects: { health: BRANCH_THIRD, speed: BRANCH_THIRD }, blurb: '+⅓× Health & Speed', icon: '/TDG/portraits/skill-polished-plate.webp' },
      c: { id: 'riposte', label: 'Riposte', effects: { damage: BRANCH_THIRD }, blurb: '+⅓× Attack', icon: '/TDG/portraits/skill-riposte.webp' },
      d: { id: 'mirror_shield', label: 'Mirror Shield', effects: { health: BRANCH_THIRD }, blurb: '+⅓× Health', icon: '/TDG/portraits/skill-mirror-shield.webp' },
      fin: { id: 'gallant_crest', label: 'Gallant Crest', effects: { damage: BRANCH_THIRD, health: BRANCH_THIRD, speed: BRANCH_THIRD }, blurb: '+⅓× Attack, Health & Speed — base stats ×2', icon: '/TDG/portraits/skill-gallant-crest.webp' },
    }),

    yeti: mkStandardBranchTree({
      a: { id: 'frost_claws', label: 'Frost Claws', effects: { damage: BRANCH_THIRD }, blurb: '+⅓× Attack', icon: '/TDG/portraits/skill-frost-claws.webp' },
      b: { id: 'glacier_step', label: 'Glacier Step', effects: { speed: BRANCH_THIRD }, blurb: '+⅓× Speed', icon: '/TDG/portraits/skill-glacier-step.webp' },
      mid: { id: 'permafrost', label: 'Permafrost', effects: { health: BRANCH_THIRD, speed: BRANCH_THIRD }, blurb: '+⅓× Health & Speed', icon: '/TDG/portraits/skill-permafrost.webp' },
      c: { id: 'rime_fists', label: 'Rime Scratch', effects: { damage: BRANCH_THIRD }, blurb: '+⅓× Attack', icon: '/TDG/portraits/skill-rime-fists.webp' },
      d: { id: 'ice_hide', label: 'Ice Hide', effects: { health: BRANCH_THIRD }, blurb: '+⅓× Health', icon: '/TDG/portraits/skill-ice-hide.webp' },
      fin: { id: 'blizzard_king', label: 'Blizzard King', effects: { damage: BRANCH_THIRD, health: BRANCH_THIRD, speed: BRANCH_THIRD }, blurb: '+⅓× Attack, Health & Speed — base stats ×2', icon: '/TDG/portraits/skill-blizzard-king.webp' },
    }),

    // Axoloti — close-range spear troop with standard branch tree.
    axoloti: mkStandardBranchTree({
      a: { id: 'honed_prong', label: 'Honed Prong', effects: { damage: BRANCH_THIRD }, blurb: '+⅓× Attack', glyph: '🔱' },
      b: { id: 'reef_stride', label: 'Reef Stride', effects: { speed: BRANCH_THIRD }, blurb: '+⅓× Speed', glyph: '🌊' },
      mid: { id: 'tide_mail', label: 'Tide Mail', effects: { health: BRANCH_THIRD, speed: BRANCH_THIRD }, blurb: '+⅓× Health & Speed', glyph: '🛡️' },
      c: { id: 'coral_thrust', label: 'Coral Thrust', effects: { damage: BRANCH_THIRD }, blurb: '+⅓× Attack', glyph: '⚔️' },
      d: { id: 'gill_guard', label: 'Gill Guard', effects: { health: BRANCH_THIRD }, blurb: '+⅓× Health', glyph: '🫧' },
      fin: { id: 'trident_crest', label: 'Trident Crest', effects: { damage: BRANCH_THIRD, health: BRANCH_THIRD, speed: BRANCH_THIRD }, blurb: '+⅓× Attack, Health & Speed — base stats ×2', glyph: '👑' },
    }),

    // Axoloti King — bazaar hero upgrades (seaweed / dual beam / red crystal).
    axoloti_king: (() => {
      const mk = (id, label, cost, glyph, blurb, opts = {}) => ({
        id, label, cost, glyph, blurb,
        requires: opts.requires || [],
        excludes: opts.excludes || [],
        effects: opts.effects || {},
      });
      const seaweed = mk(
        'golden_seaweed', 'Golden Seaweed', 220, '🌿',
        'Feast on golden seaweed — maximum health ×2.',
        { effects: { healthDouble: true } },
      );
      const dual = mk(
        'dual_beam', 'Twin Solar Beams', 260, '☀️',
        'Golden laser locks onto two targets at once instead of one.',
        { effects: { dualBeam: true } },
      );
      const crystal = mk(
        'red_crystal', 'Red Crystal', 240, '💎',
        'Crown crystal flares — beam damage ×1.55.',
        { effects: { damage: 0.55 } },
      );
      const chorus = mk(
        'reef_chorus', 'Reef Chorus', 230, '🫧',
        'Passive royal tide — every 5s, all of your Axolotis gain +15% attack and +15% heal rate for 5s.',
        { effects: { reefChorus: true } },
      );
      const order = [seaweed.id, dual.id, crystal.id, chorus.id];
      return {
        style: 'bazaar',
        order,
        skills: {
          [seaweed.id]: seaweed,
          [dual.id]: dual,
          [crystal.id]: crystal,
          [chorus.id]: chorus,
        },
        layout: { bazaar: order },
      };
    })(),

    // Angel — bazaar arrow path (forking like Archer Tower).
    // T1: Fire (terminal, quiver 3) OR More Arrows (quiver 6).
    // T2 after More: Electric (terminal, quiver 6) OR Max Quiver (quiver 9).
    angel: (() => {
      const mk = (id, label, cost, icon, blurb, opts = {}) => ({
        id, label, cost, icon, blurb,
        requires: opts.requires || [],
        excludes: opts.excludes || [],
        effects: opts.effects || {},
      });
      const fire = mk(
        'fire_arrows', 'Fire Arrows', 180, '/TDG/portraits/skill-archer-fire.webp',
        'Holy bolts ignite on hit. Seals the quiver path — max 3 arrows per flight.',
        { excludes: ['more_arrows', 'electric_arrows', 'max_quiver'], effects: { element: 'fire' } },
      );
      const more = mk(
        'more_arrows', 'More Arrows', 180, '/TDG/portraits/skill-archer-double.webp',
        'Quiver 6 — shoot six targets from the sky before diving. Opens the next fork.',
        { excludes: ['fire_arrows'] },
      );
      const electric = mk(
        'electric_arrows', 'Electric Arrows', 320, '/TDG/portraits/skill-archer-electric.webp',
        'Bolts shock and stun. Seals further quiver growth — stays at 6.',
        { requires: ['more_arrows'], excludes: ['max_quiver', 'fire_arrows'], effects: { element: 'electric' } },
      );
      const maxQ = mk(
        'max_quiver', 'Max Quiver', 320, '/TDG/portraits/skill-archer-triple.webp',
        'Quiver 9 — nine shots per flight (max). Cannot take Electric Arrows.',
        { requires: ['more_arrows'], excludes: ['electric_arrows', 'fire_arrows'] },
      );
      const order = [fire.id, more.id, electric.id, maxQ.id];
      return {
        style: 'bazaar',
        order,
        skills: {
          [fire.id]: fire,
          [more.id]: more,
          [electric.id]: electric,
          [maxQ.id]: maxQ,
        },
        layout: { bazaar: order },
      };
    })(),

    peka: mkStandardBranchTree({
      a: { id: 'searing_jaws', label: 'Searing Jaws', effects: { damage: BRANCH_THIRD }, blurb: '+⅓× Attack', icon: '/TDG/portraits/skill-searing-jaws.webp' },
      b: { id: 'storm_wings', label: 'Storm Wings', effects: { speed: BRANCH_THIRD }, blurb: '+⅓× Speed', icon: '/TDG/portraits/skill-storm-wings.webp' },
      mid: { id: 'scaled_bulk', label: 'Scaled Bulk', effects: { health: BRANCH_THIRD, speed: BRANCH_THIRD }, blurb: '+⅓× Health & Speed', icon: '/TDG/portraits/skill-scaled-bulk.webp' },
      c: { id: 'molten_breath', label: 'Molten Breath', effects: { damage: BRANCH_THIRD }, blurb: '+⅓× Attack', icon: '/TDG/portraits/skill-molten-breath.webp' },
      d: { id: 'diamond_scales', label: 'Diamond Scales', effects: { health: BRANCH_THIRD }, blurb: '+⅓× Health', icon: '/TDG/portraits/skill-diamond-scales.webp' },
      fin: { id: 'ancient_wyrm', label: 'Ancient Wyrm', effects: { damage: BRANCH_THIRD, health: BRANCH_THIRD, speed: BRANCH_THIRD }, blurb: '+⅓× Attack, Health & Speed — base stats ×2', icon: '/TDG/portraits/skill-ancient-wyrm.webp' },
    }),

    // Hunter — bazaar skills (mostly free-pick; Ravenous requires Werewolf).
    wolf_hunter: (() => {
      const mk = (id, label, cost, icon, blurb, requires = []) => ({
        id, label, cost, requires, effects: {}, icon, blurb,
      });
      const iconFor = (id) => `/TDG/portraits/skill-${id.replace(/_/g, '-')}.webp`;
      const werewolf = mk(
        'werewolf', 'Werewolf', 350, iconFor('werewolf'),
        'Sprint as a wolf to close long gaps on wolves/elephants, then turn back and attack. With no prey left, stay a wolf — fake-fight allies, steal +2 gold/sec from farms (visible only to you).',
      );
      const ravenous = mk(
        'ravenous', 'Ravenous', 500, iconFor('ravenous'),
        'Werewolf farm theft becomes +5 gold/sec.',
        ['werewolf'],
      );
      const twinSpears = mk(
        'twin_spears', 'Twin Spears', 280, iconFor('twin-spears'),
        'Carry 2 throwing spears instead of 1.',
      );
      const quickLunge = mk(
        'quick_lunge', 'Quick Lunge', 320, iconFor('quick-lunge'),
        'Lunge cooldown cut in half (10s → 5s).',
      );
      const boneCache = mk(
        'bone_cache', 'Bone Cache', 300, iconFor('bone-cache'),
        'Carry 3 more bone axes (3 → 6).',
      );
      const order = [werewolf.id, ravenous.id, twinSpears.id, quickLunge.id, boneCache.id];
      return {
        style: 'bazaar',
        order,
        skills: {
          [werewolf.id]: werewolf,
          [ravenous.id]: ravenous,
          [twinSpears.id]: twinSpears,
          [quickLunge.id]: quickLunge,
          [boneCache.id]: boneCache,
        },
        layout: { bazaar: order },
      };
    })(),
  };

  // Back-compat aliases for Knight-only call sites.
  const KNIGHT_SKILL_ORDER = UNIT_SKILL_TREES.striker.order;
  const KNIGHT_SKILLS = UNIT_SKILL_TREES.striker.skills;

  function ensureUnitSkills(rec) {
    if (!rec.skills || typeof rec.skills !== 'object') rec.skills = {};
    return rec.skills;
  }

  function unitUsesBranchTree(type) {
    return !!(type && UNIT_SKILL_TREES[type]);
  }

  /** @deprecated Prefer unitUsesBranchTree — kept for old call sites. */
  function unitUsesKnightTree(type) {
    return unitUsesBranchTree(type);
  }

  function unitSkillTree(type) {
    return UNIT_SKILL_TREES[type] || null;
  }

  function unitSkillDef(type, skillId) {
    return UNIT_SKILL_TREES[type]?.skills?.[skillId] || null;
  }

  function unitSkillOrder(type) {
    return UNIT_SKILL_TREES[type]?.order || [];
  }

  function unitHasSkill(rec, skillId) {
    return !!(rec && ensureUnitSkills(rec)[skillId]);
  }

  function unitSkillReady(rec, type, skillId) {
    const def = unitSkillDef(type, skillId);
    if (!def || !rec?.unlocked) return false;
    if (unitHasSkill(rec, skillId)) return false;
    if (!def.requires.every((req) => unitHasSkill(rec, req))) return false;
    // Mutual-exclusion forks (Angel Fire vs More, Electric vs Max Quiver, etc.).
    if (Array.isArray(def.excludes) && def.excludes.some((id) => unitHasSkill(rec, id))) return false;
    return true;
  }

  /** Angel aerial quiver size: 3 base, 6 with More Arrows, 9 with Max Quiver. */
  function angelQuiverSize(rec) {
    if (unitHasSkill(rec, 'max_quiver')) return 9;
    if (unitHasSkill(rec, 'more_arrows')) return 6;
    return 3;
  }

  /** Angel bolt elements from bazaar picks (fire and/or electric). */
  function angelArrowElements(rec) {
    const els = [];
    if (unitHasSkill(rec, 'fire_arrows')) els.push('fire');
    if (unitHasSkill(rec, 'electric_arrows')) els.push('electric');
    return els;
  }

  /** Axoloti King dual-target gold beam. */
  function axolotiKingBeamTargets(rec) {
    return unitHasSkill(rec, 'dual_beam') ? 2 : 1;
  }

  function axolotiKingDamageMult(rec) {
    return unitHasSkill(rec, 'red_crystal') ? 1.55 : 1;
  }

  function axolotiKingHealthMult(rec) {
    return unitHasSkill(rec, 'golden_seaweed') ? 2 : 1;
  }

  function axolotiKingHasReefChorus(rec) {
    return unitHasSkill(rec, 'reef_chorus');
  }

  function unitSkillCost(type, skillId) {
    return unitSkillDef(type, skillId)?.cost ?? null;
  }

  function unitBranchMultipliers(rec, type) {
    let damage = 1;
    let health = 1;
    let speed = 1;
    const tree = UNIT_SKILL_TREES[type];
    if (!tree) return { damage, health, speed };
    const skills = ensureUnitSkills(rec || {});
    for (const id of tree.order) {
      if (!skills[id]) continue;
      const e = tree.skills[id]?.effects || {};
      if (e.damage) damage += e.damage;
      if (e.health) health += e.health;
      if (e.speed) speed += e.speed;
      if (e.healthDouble) health *= 2;
    }
    return { damage, health, speed };
  }

  function knightHasSkill(rec, skillId) {
    return unitHasSkill(rec, skillId);
  }

  function knightSkillReady(rec, skillId) {
    return unitSkillReady(rec, 'striker', skillId);
  }

  function knightSkillCost(skillId) {
    return unitSkillCost('striker', skillId);
  }

  function knightSkillMultipliers(rec) {
    return unitBranchMultipliers(rec, 'striker');
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

  const SPELL_IDS = ['fireball', 'slime', 'heal', 'slow', 'rage'];
  const SPELL_LABELS = {
    fireball: 'Fireball',
    slime: 'Zombie Slime',
    heal: 'Yellow Potion',
    slow: 'Slow Potion',
    rage: 'Rage Potion',
  };
  const SPELL_ICONS = {
    fireball: '☄️',
    slime: '🧟',
    heal: '🧴',
    slow: '❄️',
    rage: '🔥',
  };
  // Spells are unlock-only — no Power skill tree.
  const SPELL_MAX_LEVEL = 1;
  const SPELL_UNLOCK_COST = { fireball: 180, slime: 220, heal: 160, slow: 200, rage: 200 };
  const SPELL_UPGRADE_COSTS = [];
  const SPELL_CAST_COST = { fireball: 45, slime: 55, heal: 40, slow: 50, rage: 50 };
  const SPELL_COOLDOWN = { fireball: 8, slime: 12, heal: 10, slow: 15, rage: 15 };

  function freshSpellRecord() {
    return { level: 0 };
  }

  function freshLaboratory() {
    const spells = {};
    for (const id of SPELL_IDS) spells[id] = freshSpellRecord();
    return {
      built: false,
      spells,
      cds: { fireball: 0, slime: 0, heal: 0, slow: 0, rage: 0 },
    };
  }

  function normalizeLaboratory(lab) {
    if (!lab) return freshLaboratory();
    lab.built = !!lab.built;
    if (!lab.spells) lab.spells = {};
    if (!lab.cds) lab.cds = { fireball: 0, slime: 0, heal: 0, slow: 0, rage: 0 };
    for (const id of SPELL_IDS) {
      if (!lab.spells[id]) lab.spells[id] = freshSpellRecord();
      lab.spells[id].level = lab.spells[id].level || 0;
      if (lab.cds[id] == null) lab.cds[id] = 0;
    }
    return lab;
  }

  function laboratoryRecord(p) {
    ensureLiveArmy(p);
    p.liveArmy.laboratory = normalizeLaboratory(p.liveArmy.laboratory);
    return p.liveArmy.laboratory;
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
  const ECON_BRANCH_COSTS = [300, 900, 3200];
  const HARVEST_BASE_INTERVAL = 4;
  const FARM_YIELD_LEVELS = [5, 10, 15, 25];
  const MINT_YIELD_LEVELS = [10, 15, 20, 25];
  const FARM_YIELD_START = FARM_YIELD_LEVELS[0];
  const MINT_YIELD_START = MINT_YIELD_LEVELS[0];
  const YIELD_MAX = 25;

  function normalizeEcoBuilding(rec, type) {
    if (!rec) return { unlocked: false, speed: 0, yield: 0 };
    const baseYield = type === 'mint' ? MINT_YIELD_START : FARM_YIELD_START;
    if (rec.speed == null) rec.speed = 0;
    if (rec.yield == null) rec.yield = 0;
    if (rec.unlocked && !rec.yieldCoinAmount) {
      rec.yield = baseYield;
      rec.yieldCoinAmount = true;
    }
    if (rec.unlocked && rec.yield < baseYield) rec.yield = baseYield;
    return rec;
  }
  const BASE_BRANCH_MAX = { income: 3, health: 3, defense: 3 };
  const BASE_INCOME_UPGRADE_COSTS = [150, 300, 450];
  const BASE_BRANCHES = ['income', 'health', 'defense'];
  const BASE_BRANCH_LABELS = { income: 'Income', health: 'Health', defense: 'Guns' };
  const BASE_BRANCH_ICONS = { income: '🪙', health: '❤️', defense: '🔫' };

  function freshMissileUpgrades() {
    return { rate: 1, damage: 1, radius: 1 };
  }

  function ensureLiveArmy(p) {
    if (!p.liveArmy) {
      p.liveArmy = {
        barracks: freshBarracks(),
        engineers: freshEngineers(),
        economy: freshEconomy(),
        laboratory: freshLaboratory(),
      };
    }
    if (!p.liveArmy.barracks) p.liveArmy.barracks = freshBarracks();
    if (!p.liveArmy.engineers) p.liveArmy.engineers = freshEngineers();
    if (!p.liveArmy.economy) p.liveArmy.economy = freshEconomy();
    p.liveArmy.laboratory = normalizeLaboratory(p.liveArmy.laboratory);
    return p.liveArmy;
  }

  function engineersRecord(p) {
    ensureLiveArmy(p);
    p.liveArmy.engineers = normalizeEngineers(p.liveArmy.engineers);
    return p.liveArmy.engineers;
  }

  function towerRecord(p, type) {
    const eng = engineersRecord(p);
    if (!eng.towers[type]) eng.towers[type] = freshTowerRecord();
    return eng.towers[type];
  }

  function unitRecord(p, type) {
    ensureLiveArmy(p);
    if (!p.liveArmy.barracks.units) p.liveArmy.barracks.units = {};
    if (!p.liveArmy.barracks.units[type]) p.liveArmy.barracks.units[type] = freshUnitRecord();
    ensureUnitSkills(p.liveArmy.barracks.units[type]);
    return p.liveArmy.barracks.units[type];
  }

  function economyRecord(p) {
    ensureLiveArmy(p);
    if (!p.liveArmy.economy) p.liveArmy.economy = freshEconomy();
    const eco = p.liveArmy.economy;
    eco.farm = normalizeEcoBuilding(eco.farm, 'farm');
    eco.mint = normalizeEcoBuilding(eco.mint, 'mint');
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
    gameRules.towers.missile = false;
    gameRules.towers.archer = true;
    gameRules.towers.catapult = true;
    gameRules.towers.mint = true;
    gameRules.towers.farm = true;
    gameRules.towers.barracks = true;
    gameRules.towers.engineers = true;
    gameRules.towers.laboratory = true;
    gameRules.units.goblin = true;
    gameRules.units.yeti = true;
    gameRules.units.angel = true;
    gameRules.units.axoloti = true;
    gameRules.units.axoloti_king = true;
    gameRules.units.farmer = true;
    gameRules.units.bowman = true;
    gameRules.units.swordsman = true;
    for (const p of players) {
      p.liveArmy = {
        barracks: freshBarracks(),
        engineers: freshEngineers(),
        economy: freshEconomy(),
        laboratory: freshLaboratory(),
      };
    }
    syncBuildToolbar();
    syncBarracksPanelCopy();
    syncEngineersPanelCopy();
    syncEconomyPanelCopy();
    syncLaboratoryPanelCopy();
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
    el.textContent = '';
    el.hidden = true;
  }

  function syncEngineersPanelCopy() {
    const el = document.getElementById('engineers-upgrade-desc');
    if (!el) return;
    el.textContent = '';
    el.hidden = true;
  }

  function syncLaboratoryPanelCopy() {
    const el = document.getElementById('laboratory-upgrade-desc');
    if (!el) return;
    el.textContent = '';
    el.hidden = true;
  }

  function syncEconomyPanelCopy() {
    const el = document.getElementById('economy-upgrade-desc');
    if (!el) return;
    el.textContent = pvpMode
      ? 'Open HQ, Farm, Mint, or Commander cards. Enemy levels stay hidden.'
      : 'Tap a card, then the tree, to upgrade Headquarters, Farm, Mint, or Commander.';
  }

  function initPlayer(p) {
    ensureLiveArmy(p);
    if (!p.liveArmy.economy) p.liveArmy.economy = freshEconomy();
    if (!p.liveArmy.barracks) p.liveArmy.barracks = freshBarracks();
    p.liveArmy.engineers = normalizeEngineers(p.liveArmy.engineers);
    p.liveArmy.laboratory = normalizeLaboratory(p.liveArmy.laboratory);
    economyRecord(p);
    for (const ut of UNIT_ORDER) unitRecord(p, ut);
    for (const tt of COMBAT_TOWERS) towerRecord(p, tt);
  }

  function setPlayersRef(players) { playersRef = players; }

  function getTowerFootprint(t) {
    const type = t.towerType || t;
    if (type === 'laboratory') return LABORATORY_SIZE;
    if (type === 'farm' || type === 'barracks' || type === 'engineers' || type === 'missile') return STRUCTURE_SIZE;
    if (type === 'mint') return MINT_SIZE;
    if (type === 'turret') return TURRET_SIZE;
    if (type === 'archer') return ARCHER_SIZE;
    if (type === 'laser' || type === 'spread') return COMBAT_TOWER_SIZE;
    return t.size || COMBAT_TOWER_SIZE;
  }

  function getPlacementCollisionRadius(towerType) {
    const type = towerType?.towerType || towerType;
    // Farm visual footprint is wide — keep collision at least half-size + pad
    // so farms cannot clip other structures even after gap clearance.
    if (type === 'farm') return Math.ceil(FARM_SIZE / 2) + 6;
    if (type === 'laboratory') return 20;
    if (type === 'barracks' || type === 'engineers' || type === 'missile' || type === 'archer') return 26;
    if (type === 'mint') return 12;
    if (type === 'turret') return 20;
    if (type === 'laser' || type === 'spread') return 14;
    return 18;
  }

  const FARM_SEPARATION_GAP = 10;

  function modifyTowerDef(type, def, ownerId, opts) {
    if (!active) return def;
    const d = { ...def };
    if (type === 'farm') { d.size = FARM_SIZE; d.name = 'Farm'; d.style = 'farm_live'; }
    else if (type === 'mint') { d.size = MINT_SIZE; d.name = 'Bank'; d.style = 'mint_live'; }
    else if (type === 'barracks') { d.size = STRUCTURE_SIZE; d.name = 'Barracks'; d.style = 'barracks'; d.cost = 100; d.hp = 120; }
    else if (type === 'engineers') { d.size = STRUCTURE_SIZE; d.name = 'Tower Depot'; d.style = 'engineers'; d.cost = 100; d.hp = 110; }
    else if (type === 'laboratory') { d.size = LABORATORY_SIZE; d.name = "Wizard's Nest"; d.style = 'laboratory'; d.cost = 100; d.hp = 130; }
    else if (type === 'missile') {
      d.size = STRUCTURE_SIZE; d.name = 'Missile Base'; d.style = 'missile_live';
      d.fireInterval = 9; d.damage = 4; d.blastRadius = 72; d.missileSpeed = 260;
    }
    else if (type === 'laser') { d.size = COMBAT_TOWER_SIZE; d.name = 'Rail Gun'; d.style = 'railgun'; d.color = '#EAB308'; d.accent = '#CA8A04'; d.range = 680; }
    else if (type === 'spread') { d.size = COMBAT_TOWER_SIZE; d.knockback = SPREAD_KB_WEAK; d.name = 'Spreader'; }
    else if (type === 'turret') { d.size = TURRET_SIZE; d.hp = 140; d.damage = 24; d.name = 'Turret'; }
    else if (type === 'archer') {
      d.size = ARCHER_SIZE; d.name = 'Archer Tower'; d.style = 'archer';
      d.range = 540; d.damage = 25; d.fireRate = 0.48; d.arrowCount = 3;
      d.hp = 130; d.color = '#92400e'; d.accent = '#78350f';
    }
    else if (type === 'catapult') {
      d.size = COMBAT_TOWER_SIZE + 6; d.name = 'Catapult'; d.style = 'catapult';
      d.range = 1080; d.damage = 68; d.splashDamage = 20; d.splashRadius = 56;
      d.knockback = 36; d.fireRate = 0.36; d.hp = 105;
      d.maxMiss = 98;
      d.color = '#92400e'; d.accent = '#57534e';
    }

    // Base cannons run on their own dedicated skill tree (opts.skipEngineerBonus).
    // Combat tower global Depot mastery was removed — base defs only.
    return d;
  }

  function applyStatBonuses(u, type, pid) {
    const rec = playersRef?.[pid]?.liveArmy?.barracks?.units?.[type];
    if (!rec) return;

    let dmgMult;
    let hpMult;
    let spdMult;
    if (unitUsesBranchTree(type)) {
      const m = unitBranchMultipliers(rec, type);
      dmgMult = m.damage;
      hpMult = m.health;
      spdMult = m.speed;
    } else {
      const spdLvl = Math.min(rec.speed || 0, STAT_MAX);
      const dmgLvl = Math.min(rec.damage || 0, STAT_MAX);
      const hpLvl = Math.min(rec.health || 0, STAT_MAX);
      dmgMult = UNIT_DAMAGE_MULT[dmgLvl] || 1;
      hpMult = UNIT_HEALTH_MULT[hpLvl] || 1;
      spdMult = UNIT_SPEED_MULT[spdLvl] || 1;
    }

    if (type === 'striker') {
      u.name = 'Knight';
      u.behavior = 'knight';
      u.prefersUnits = true;
    } else if (type === 'farmer') {
      u.name = 'Farmer';
      u.behavior = 'farmer';
      u.prefersUnits = true;
      u.targetsUnits = true;
      u.targetsTowers = false;
      u.targetsBase = false;
    } else if (type === 'goblin') {
      u.name = 'Goblin';
      u.behavior = 'goblin';
      u.cost = 22;
      u.size = 14;
      u.targetsUnits = false;
      u.targetsTowers = true;
      u.targetsBase = false;
      u.immuneRailgun = true;
      u.lootMult = dmgMult;
    } else if (type === 'axoloti') {
      u.name = 'Axoloti';
      u.behavior = 'axoloti';
      u.element = 'water';
      u.waterRegen = true;
    } else if (type === 'axoloti_king') {
      u.name = 'Axoloti King';
      u.behavior = 'axoloti_king';
      u.element = 'water';
      u.waterRegen = true;
      u.unique = true;
      const recKing = playersRef?.[pid]?.liveArmy?.barracks?.units?.axoloti_king;
      u.beamTargets = axolotiKingBeamTargets(recKing);
    }

    const baseHp = u.hp || 0;
    const baseDmg = u.damage || 0;
    const baseSpd = u.speed || 0;
    u.hp = Math.round(baseHp * hpMult);
    u.damage = Math.round(baseDmg * dmgMult);
    u.speed = Math.round(baseSpd * spdMult);
    if ((type === 'sniper' || type === 'bowman') && u.range) {
      u.range = Math.round(u.range * spdMult);
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

  function hasLaboratory(p) {
    return p.turrets.some(t => t.towerType === 'laboratory' && t.hp > 0);
  }

  function spellLevel(p, spellId) {
    const raw = laboratoryRecord(p).spells[spellId]?.level || 0;
    return Math.min(SPELL_MAX_LEVEL, raw);
  }

  function spellUnlocked(p, spellId) {
    return spellLevel(p, spellId) > 0;
  }

  function spellUnlockOrUpgradeCost(p, spellId) {
    const lvl = spellLevel(p, spellId);
    if (lvl <= 0) return SPELL_UNLOCK_COST[spellId] ?? 180;
    if (lvl >= SPELL_MAX_LEVEL) return null;
    return SPELL_UPGRADE_COSTS[lvl - 1] ?? null;
  }

  function spellUnlockCost(spellId) {
    return SPELL_UNLOCK_COST[spellId] ?? 180;
  }

  function spellUpgradeCostAtLevel(level) {
    // Cost to go from `level` → level+1 (level is current owned level, 1 or 2).
    if (level < 1 || level >= SPELL_MAX_LEVEL) return null;
    return SPELL_UPGRADE_COSTS[level - 1] ?? null;
  }

  function spellCastCost(spellId, level) {
    const base = SPELL_CAST_COST[spellId] ?? 40;
    const lvl = Math.max(1, level || 1);
    return Math.round(base * (1 - (lvl - 1) * 0.08));
  }

  function spellCooldown(spellId, level) {
    const base = SPELL_COOLDOWN[spellId] ?? 10;
    const lvl = Math.max(1, level || 1);
    return Math.max(1, Math.max(4, base - (lvl - 1) * 1.5));
  }

  function spellStats(spellId, level) {
    const lvl = Math.max(1, Math.min(SPELL_MAX_LEVEL, level || 1));
    if (spellId === 'fireball') {
      return {
        radius: 55 + (lvl - 1) * 8,
        damage: 85 + (lvl - 1) * 30,
        knockback: 160 + (lvl - 1) * 35,
        dragonMult: 2.2 + (lvl - 1) * 0.4,
      };
    }
    if (spellId === 'slime') {
      return {
        radius: 78 + (lvl - 1) * 10,
        duration: 3, // active zombie attack window
        transformTime: 1,
        wearoffTime: 1,
      };
    }
    if (spellId === 'slow') {
      return {
        radius: 90,
        duration: 7,
        speedMult: 0.45,
      };
    }
    if (spellId === 'rage') {
      return {
        radius: 90,
        duration: 5,
        moveMult: 1.35,
        attackMult: 1.5,
      };
    }
    // heal: yellow potion — +30 HP/s base = +10 HP every 1/3s (units + towers + base)
    return {
      radius: 90 + (lvl - 1) * 12,
      duration: 3 + (lvl - 1) * 0.5,
      healPerTick: 10 + (lvl - 1) * 4,
      tickInterval: 1 / 3,
    };
  }

  function buySpellUpgrade(p, spellId) {
    if (!SPELL_IDS.includes(spellId)) return false;
    if (!hasLaboratory(p)) return false;
    const lab = laboratoryRecord(p);
    const cost = spellUnlockOrUpgradeCost(p, spellId);
    if (cost == null || p.coins < cost) return false;
    p.coins -= cost;
    lab.spells[spellId].level = (lab.spells[spellId].level || 0) + 1;
    return true;
  }

  function tickSpellCooldowns(p, dt) {
    const lab = laboratoryRecord(p);
    for (const id of SPELL_IDS) {
      lab.cds[id] = Math.max(0, (lab.cds[id] || 0) - dt);
    }
  }

  function canCastSpell(p, spellId) {
    if (!hasLaboratory(p)) return false;
    const lvl = spellLevel(p, spellId);
    if (lvl <= 0) return false;
    const lab = laboratoryRecord(p);
    if ((lab.cds[spellId] || 0) > 0) return false;
    return p.coins >= spellCastCost(spellId, lvl);
  }

  function beginSpellCast(p, spellId) {
    if (!canCastSpell(p, spellId)) return false;
    const lvl = spellLevel(p, spellId);
    const lab = laboratoryRecord(p);
    p.coins -= spellCastCost(spellId, lvl);
    lab.cds[spellId] = spellCooldown(spellId, lvl);
    return true;
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
    if (lvl >= STAT_MAX) return null;
    const table = stat === 'speed' ? STAT_SPEED_UPGRADE_COSTS : STAT_UPGRADE_COSTS;
    return table[lvl];
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
    const lvl = engineerStatLevel(rec, branch);
    if (lvl >= ENGINEER_STAT_MAX) return null;
    return ENGINEER_UPGRADE_COSTS[lvl];
  }

  function isCombatTowerType(type) {
    return COMBAT_TOWERS.includes(type);
  }

  function turretEngineerBranches() {
    return TURRET_ENGINEER_BRANCHES.slice();
  }

  function engineerBranchesForTower(towerType) {
    if (towerType === 'turret') return turretEngineerBranches();
    return ENGINEER_BRANCHES.filter((b) => b !== 'knockback' || towerType === 'spread');
  }

  function engineerStatLevel(rec, branch) {
    if (!rec || !ENGINEER_STAT_KEYS.includes(branch)) return 0;
    return rec[branch] || 0;
  }

  function incrementEngineerStat(rec, branch) {
    if (!rec || !ENGINEER_STAT_KEYS.includes(branch)) return false;
    rec[branch] = engineerStatLevel(rec, branch) + 1;
    return true;
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

  function harvestYieldLevels(type) {
    return type === 'mint' ? MINT_YIELD_LEVELS : FARM_YIELD_LEVELS;
  }

  function harvestYieldBase(type) {
    return harvestYieldLevels(type)[0];
  }

  function harvestYieldTier(rec, type) {
    const levels = harvestYieldLevels(type);
    const idx = levels.indexOf(rec.yield);
    return idx >= 0 ? idx : 0;
  }

  function nextHarvestYield(type, currentYield) {
    const levels = harvestYieldLevels(type);
    const tier = harvestYieldTier({ yield: currentYield }, type);
    if (tier >= levels.length - 1) return null;
    return levels[tier + 1];
  }

  function economyYieldCost(p, type) {
    const eco = economyRecord(p);
    const rec = type === 'farm' ? eco.farm : eco.mint;
    const tier = harvestYieldTier(rec, type);
    if (tier >= ECON_BRANCH_MAX) return null;
    return ECON_BRANCH_COSTS[tier];
  }

  function harvestInterval(p, type) {
    const eco = economyRecord(p);
    const rec = type === 'farm' ? eco.farm : eco.mint;
    if (!rec.unlocked) {
      return HARVEST_BASE_INTERVAL;
    }
    // Farms and mints share the same harvest calendar (base 4s, faster with speed upgrades).
    return Math.max(1, HARVEST_BASE_INTERVAL - (rec.speed || 0));
  }

  function harvestAmount(p, type) {
    const eco = economyRecord(p);
    const rec = type === 'farm' ? eco.farm : eco.mint;
    if (!rec.unlocked) return 0;
    return rec.yield || harvestYieldBase(type);
  }

  function economyBaseCost(p, branch) {
    const eco = economyRecord(p);
    const lvl = eco.base[branch] || 0;
    if (branch === 'income') {
      if (lvl >= BASE_INCOME_UPGRADE_COSTS.length) return null;
      return BASE_INCOME_UPGRADE_COSTS[lvl];
    }
    const bases = { health: 125, defense: 155 };
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
    if (towerType === 'laboratory') {
      return p.turrets.filter(t => t.towerType === 'laboratory' && t.hp > 0).length < 1;
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
    if (tool === 'laboratory') return canPlaceStructure(p, 'laboratory');
    if (SPELL_IDS.includes(tool)) return hasLaboratory(p) && spellUnlocked(p, tool);
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
    if (unit.type === 'tank') kb = 0; // Elephants are too heavy — they feel no pushback.
    else if (unit.type === 'peka') kb *= 0.06;
    else if (unit.type === 'speed') kb *= 1.4; // Wolves are light — pushed a bit farther.
    const spd = Math.hypot(pellet.vx, pellet.vy) || 1;
    return { nx: pellet.vx / spd, ny: pellet.vy / spd, kb };
  }

  function goblinLootMult(damageTier) {
    const lvl = Math.min(damageTier || 0, STAT_MAX);
    return UNIT_DAMAGE_MULT[lvl] || 1;
  }

  function goblinLootPreview(damageTier, towerType) {
    const mult = goblinLootMult(damageTier);
    const base = towerType === 'mint' ? 10 : 4;
    const mintBonus = towerType === 'mint' ? 2.8 : 1;
    return Math.max(1, Math.floor(base * mult * mintBonus));
  }

  function goblinLootAmount(attacker, towerType) {
    const rec = playersRef?.[attacker.owner]?.liveArmy?.barracks?.units?.goblin;
    if (unitUsesBranchTree('goblin') && rec) {
      const mult = unitBranchMultipliers(rec, 'goblin').damage;
      const base = towerType === 'mint' ? 10 : 4;
      const mintBonus = towerType === 'mint' ? 2.8 : 1;
      return Math.max(1, Math.floor(base * mult * mintBonus));
    }
    const dmgTier = rec?.damage || 0;
    return goblinLootPreview(dmgTier, towerType);
  }

  function decorateTower(t, ownerId) {
    if (!active) return t;
    if (t.towerType === 'missile' && !t.missileUpgrades) t.missileUpgrades = freshMissileUpgrades();
    if (t.towerType === 'spread' && t.spreadElement === undefined) t.spreadElement = null;
    if (t.towerType === 'barracks') playersRef[ownerId].liveArmy.barracks.built = true;
    if (t.towerType === 'engineers') playersRef[ownerId].liveArmy.engineers.built = true;
    if (t.towerType === 'laboratory') laboratoryRecord(playersRef[ownerId]).built = true;
    return t;
  }

  function missileStats(t, ownerId) {
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
        units[ut] = { unlocked: !!rec?.unlocked, speed: 0, damage: 0, health: 0, skills: {} };
      }
      ep.liveArmy.barracks = { built: !!ep.liveArmy.barracks.built, units };
    }
    if (ep.liveArmy?.engineers) {
      const towers = {};
      for (const tt of COMBAT_TOWERS) {
        const rec = ep.liveArmy.engineers.towers?.[tt];
        towers[tt] = { unlocked: !!rec?.unlocked, damage: 0, range: 0, health: 0, knockback: 0, firerate: 0 };
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
    if (ep.liveArmy?.laboratory) {
      const spells = {};
      for (const id of SPELL_IDS) {
        const rec = ep.liveArmy.laboratory.spells?.[id];
        spells[id] = { level: rec?.level > 0 ? 1 : 0 };
      }
      ep.liveArmy.laboratory = {
        built: !!ep.liveArmy.laboratory.built,
        spells,
        cds: { fireball: 0, slime: 0, heal: 0, slow: 0, rage: 0 },
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

  function unitStatMultiplier(stat, tier) {
    const lvl = Math.min(tier, STAT_MAX);
    if (stat === 'damage') return UNIT_DAMAGE_MULT[lvl] || 1;
    if (stat === 'health') return UNIT_HEALTH_MULT[lvl] || 1;
    if (stat === 'speed') return UNIT_SPEED_MULT[lvl] || 1;
    return 1;
  }

  function unitEffectiveMultipliers(rec, type) {
    if (unitUsesBranchTree(type)) return unitBranchMultipliers(rec, type);
    return {
      damage: unitStatMultiplier('damage', rec?.damage || 0),
      health: unitStatMultiplier('health', rec?.health || 0),
      speed: unitStatMultiplier('speed', rec?.speed || 0),
    };
  }

  function syncBuildToolbar() {
    // Hotbar icons/labels are refreshed by syncHotbarUI in updateUI.
  }

  return {
    isActive,
    isPvpMode,
    onBattleStart,
    onBattleEnd,
    syncBarracksPanelCopy,
    syncEngineersPanelCopy,
    syncEconomyPanelCopy,
    syncLaboratoryPanelCopy,
    initPlayer,
    setPlayersRef,
    getTowerFootprint,
    getPlacementCollisionRadius,
    modifyTowerDef,
    modifyUnitDef,
    hasBarracks,
    hasEngineers,
    hasLaboratory,
    laboratoryRecord,
    spellLevel,
    spellUnlocked,
    spellUnlockOrUpgradeCost,
    spellUnlockCost,
    spellUpgradeCostAtLevel,
    spellCastCost,
    spellCooldown,
    spellStats,
    buySpellUpgrade,
    tickSpellCooldowns,
    canCastSpell,
    beginSpellCast,
    SPELL_IDS,
    SPELL_LABELS,
    SPELL_ICONS,
    SPELL_MAX_LEVEL,
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
    harvestYieldBase,
    harvestYieldTier,
    nextHarvestYield,
    unitStatMultiplier,
    unitEffectiveMultipliers,
    unitUsesKnightTree,
    unitUsesBranchTree,
    UNIT_SKILL_TREES,
    unitSkillTree,
    unitSkillDef,
    unitSkillOrder,
    unitHasSkill,
    unitSkillReady,
    unitSkillCost,
    angelQuiverSize,
    angelArrowElements,
    axolotiKingBeamTargets,
    axolotiKingDamageMult,
    axolotiKingHealthMult,
    axolotiKingHasReefChorus,
    unitBranchMultipliers,
    KNIGHT_SKILLS,
    KNIGHT_SKILL_ORDER,
    knightHasSkill,
    knightSkillReady,
    knightSkillCost,
    knightSkillMultipliers,
    ensureUnitSkills,
    ECON_BRANCH_MAX,
    FARM_YIELD_START,
    MINT_YIELD_START,
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
    freshLaboratory,
    COMBAT_TOWERS,
    isCombatTowerType,
    engineerBranchesForTower,
    engineerStatLevel,
    incrementEngineerStat,
    TOWER_LABELS,
    TOWER_UNLOCK_COST,
    UNIT_ORDER,
    HERO_UNITS,
    isHeroUnit,
    UNIT_LABELS,
    UNIT_UNLOCK_COST,
    STAT_BRANCHES,
    STAT_MAX,
    ENGINEER_BRANCHES,
    TURRET_ENGINEER_BRANCHES,
    ENGINEER_BRANCH_LABELS,
    ENGINEER_BRANCH_ICONS,
    ENGINEER_STAT_MAX,
    CANNON_DAMAGE_MULT,
    CANNON_FIRERATE_MULT,
    CANNON_RANGE_MULT,
    ECON_UNLOCK_COST,
    ECON_BRANCH_COSTS,
    BASE_BRANCHES,
    BASE_BRANCH_LABELS,
    BASE_BRANCH_ICONS,
    BASE_BRANCH_MAX,
    STRUCTURE_SIZE,
    LABORATORY_SIZE,
    TURRET_SIZE,
    FARM_SIZE,
    FARM_SEPARATION_GAP,
  };
})();
