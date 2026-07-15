'use strict';

/**
 * Whitelist of client action types forwarded through the authoritative tick.
 * Unknown types are dropped server-side so clients cannot inject arbitrary payloads.
 */

const ALLOWED_ACTION_TYPES = new Set([
  'spawn_unit',
  'commander_deploy',
  'place_tower',
  'move_tower',
  'income_upgrade',
  'economy_upgrade',
  'barracks_upgrade',
  'engineers_upgrade',
  'missile_upgrade',
  'spread_element',
  'spread_skill',
  'archer_volley',
  'archer_skill',
  'catapult_oil',
  'sell_tower',
  'cannon_upgrade',
  'roof_archer_count',
  'roof_archer_arrows',
  'commander_upgrade',
  'commander_special',
  'commander_stance',
  'lab_spell_upgrade',
  'cast_spell',
]);

function sanitizeAction(action) {
  if (!action || typeof action !== 'object') return null;
  if (typeof action.type !== 'string' || !ALLOWED_ACTION_TYPES.has(action.type)) {
    return null;
  }
  // Shallow clone — keep enumerable fields; strip prototype pollution keys.
  const clean = { type: action.type };
  for (const [key, value] of Object.entries(action)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    if (key === 'type') continue;
    clean[key] = value;
  }
  return clean;
}

module.exports = {
  ALLOWED_ACTION_TYPES,
  sanitizeAction,
};
