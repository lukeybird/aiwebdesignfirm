'use strict';

/**
 * Server-side PvP authority: owns the tick clock, orders inputs,
 * tracks minimal match state for win/lose, and emits snapshots.
 *
 * Full combat visuals still render on clients by applying the same
 * ordered inputs each tick (deterministic lockstep). The server is
 * the only source of frame advancement and match outcome.
 */

const { sanitizeAction } = require('./actions');

const FIXED_DT = 1 / 15;
const TICK_MS = Math.round(FIXED_DT * 1000);
const MAX_INPUTS_PER_TICK = 24;
const MAX_INPUT_QUEUE = 64;
const SNAPSHOT_EVERY_TICKS = 3;
const DISCONNECT_GRACE_MS = 12_000;
const INPUT_RATE_WINDOW_MS = 1000;
const INPUT_RATE_LIMIT = 60;
const WORLD_MIN_INTERVAL_MS = 250;
const AUTHORITY_SLOT = 0;

function freshPlayer(name) {
  return {
    name: name || 'Player',
    coins: 150,
    baseHp: 1000,
    baseMaxHp: 1000,
  };
}

class AuthoritativeMatch {
  constructor({ roomId, startsAt, players }) {
    this.roomId = roomId;
    this.startsAt = startsAt || Date.now() + 4500;
    this.frame = 0;
    this.phase = 'countdown'; // countdown | combat | gameover
    this.players = [
      freshPlayer(players?.[0]?.name),
      freshPlayer(players?.[1]?.name),
    ];
    this.pendingInputs = []; // { slot, aid, action, receivedAt }
    this.seenAids = new Set();
    this.recentAids = [];
    this.winnerSlot = null;
    this.endReason = null;
    this.combatStarted = false;
    this.lastTickAt = Date.now();
    this.inputRates = [{ ts: [], }, { ts: [], }];
    this.disconnectDeadlines = [null, null];
    this.connected = [false, false];
    this.authoritySlot = AUTHORITY_SLOT;
    this.lastWorldAt = 0;
    this.lastWorldState = null;
  }

  /**
   * Accept a full world snapshot from the designated authority client.
   * Relay becomes absolute truth for both browsers.
   */
  acceptWorldState(slot, state) {
    if (this.phase === 'gameover') return { ok: false, error: 'Match over' };
    if (slot !== this.authoritySlot) return { ok: false, error: 'Not authority' };
    if (!state || typeof state !== 'object' || !Array.isArray(state.players)) {
      return { ok: false, error: 'Invalid world state' };
    }
    const now = Date.now();
    if (now - this.lastWorldAt < WORLD_MIN_INTERVAL_MS) {
      return { ok: false, error: 'World rate limited', soft: true };
    }
    this.lastWorldAt = now;
    this.lastWorldState = state;

    // Mirror HP for match-end detection on the server.
    for (let i = 0; i < 2; i++) {
      const src = state.players[i];
      if (!src) continue;
      if (Number.isFinite(src.baseHp)) this.players[i].baseHp = src.baseHp;
      if (Number.isFinite(src.baseMaxHp)) this.players[i].baseMaxHp = src.baseMaxHp;
      if (Number.isFinite(src.coins)) this.players[i].coins = src.coins;
    }

    const hp0 = this.players[0].baseHp;
    const hp1 = this.players[1].baseHp;
    if (this.phase === 'combat' && (hp0 <= 0 || hp1 <= 0)) {
      if (hp0 <= 0 && hp1 <= 0) this.endMatch(null, 'draw');
      else if (hp0 <= 0) this.endMatch(1, 'base_destroyed');
      else this.endMatch(0, 'base_destroyed');
    }

    return {
      ok: true,
      world: {
        type: 'world',
        roomId: this.roomId,
        frame: Number.isFinite(state.frame) ? state.frame : this.frame,
        from: slot,
        state,
        matchOver: this.phase === 'gameover'
          ? { winnerSlot: this.winnerSlot, endReason: this.endReason }
          : undefined,
        t: now,
      },
    };
  }

  setConnected(slot, connected) {
    if (slot !== 0 && slot !== 1) return;
    this.connected[slot] = connected;
    if (connected) {
      this.disconnectDeadlines[slot] = null;
    } else if (this.phase === 'combat' && this.disconnectDeadlines[slot] == null) {
      this.disconnectDeadlines[slot] = Date.now() + DISCONNECT_GRACE_MS;
    }
  }

  rateLimitOk(slot) {
    const now = Date.now();
    const bucket = this.inputRates[slot];
    bucket.ts = bucket.ts.filter((t) => now - t < INPUT_RATE_WINDOW_MS);
    if (bucket.ts.length >= INPUT_RATE_LIMIT) return false;
    bucket.ts.push(now);
    return true;
  }

  enqueueInput(slot, payload) {
    if (this.phase === 'gameover') return { ok: false, error: 'Match over' };
    if (slot !== 0 && slot !== 1) return { ok: false, error: 'Bad slot' };
    if (!this.rateLimitOk(slot)) return { ok: false, error: 'Rate limited' };

    const aid = typeof payload?.aid === 'string' ? payload.aid.slice(0, 64) : '';
    const action = sanitizeAction(payload?.action);
    if (!aid || !action) {
      return { ok: false, error: 'Invalid input' };
    }
    if (this.seenAids.has(aid)) return { ok: true, duplicate: true };
    if (this.pendingInputs.length >= MAX_INPUT_QUEUE) {
      return { ok: false, error: 'Input queue full' };
    }

    this.seenAids.add(aid);
    this.recentAids.push(aid);
    if (this.recentAids.length > 48) this.recentAids.shift();
    if (this.seenAids.size > 400) {
      // Bound memory — aids older than recent window can be forgotten.
      const keep = new Set(this.recentAids);
      this.seenAids = keep;
    }

    this.pendingInputs.push({
      slot,
      aid,
      action,
      receivedAt: Date.now(),
    });
    return { ok: true };
  }

  maybeStartCombat(now = Date.now()) {
    if (this.combatStarted) return;
    if (now < this.startsAt) return;
    if (!this.connected[0] || !this.connected[1]) return;
    this.combatStarted = true;
    this.phase = 'combat';
  }

  applyServerSideEffects(slot, action) {
    // Lightweight effects the server must own for outcomes / soft state.
    if (!action || typeof action !== 'object') return;
    if (action.type === 'cheat_set_base_hp' && Number.isFinite(action.hp)) {
      // Ignored — clients cannot write HP directly.
      return;
    }
    // Economy and combat mutation stay on clients via ordered lockstep inputs.
    // Server tracks forfeit/disconnect outcomes only, plus optional checksum fields.
  }

  checkDisconnectForfeits(now = Date.now()) {
    if (this.phase !== 'combat') return null;
    for (let slot = 0; slot < 2; slot++) {
      const deadline = this.disconnectDeadlines[slot];
      if (deadline != null && now >= deadline && !this.connected[slot]) {
        const winner = slot === 0 ? 1 : 0;
        this.endMatch(winner, 'disconnect');
        return { winnerSlot: winner, endReason: 'disconnect' };
      }
    }
    return null;
  }

  endMatch(winnerSlot, endReason) {
    if (this.phase === 'gameover') return;
    this.phase = 'gameover';
    this.winnerSlot = winnerSlot;
    this.endReason = endReason;
    if (winnerSlot === 0 || winnerSlot === 1) {
      const loser = winnerSlot === 0 ? 1 : 0;
      this.players[loser].baseHp = 0;
    }
  }

  forfeit(slot) {
    if (slot !== 0 && slot !== 1) return null;
    if (this.phase === 'gameover') return null;
    const winner = slot === 0 ? 1 : 0;
    this.endMatch(winner, 'forfeit');
    return { winnerSlot: winner, endReason: 'forfeit', from: slot };
  }

  /**
   * Advance one authoritative frame. Returns the tick message for clients.
   */
  step(now = Date.now()) {
    this.maybeStartCombat(now);
    const disconnectResult = this.checkDisconnectForfeits(now);

    const batch = [];
    if (this.phase === 'combat') {
      while (batch.length < MAX_INPUTS_PER_TICK && this.pendingInputs.length) {
        const item = this.pendingInputs.shift();
        this.applyServerSideEffects(item.slot, item.action);
        batch.push({
          slot: item.slot,
          aid: item.aid,
          action: item.action,
        });
      }
      this.frame += 1;
    }

    this.lastTickAt = now;

    const msg = {
      type: 'tick',
      roomId: this.roomId,
      frame: this.frame,
      phase: this.phase,
      dt: FIXED_DT,
      inputs: batch,
      authoritySlot: this.authoritySlot,
      t: now,
    };

    // Lightweight HP snapshot (not full world — clients get full world from authority).
    if (
      this.phase === 'combat' &&
      (this.frame % SNAPSHOT_EVERY_TICKS === 0 || batch.length > 0)
    ) {
      msg.snapshot = this.getSnapshot();
    }

    if (disconnectResult || this.phase === 'gameover') {
      msg.matchOver = {
        winnerSlot: this.winnerSlot,
        endReason: this.endReason,
      };
    }

    return msg;
  }

  getSnapshot() {
    return {
      frame: this.frame,
      phase: this.phase,
      confirmedAids: this.recentAids.slice(-24),
      hostSentAt: Date.now(),
      serverAuth: true,
      authoritySlot: this.authoritySlot,
      players: this.players.map((p) => ({
        name: p.name,
        coins: p.coins,
        baseHp: p.baseHp,
        baseMaxHp: p.baseMaxHp,
      })),
      winnerSlot: this.winnerSlot,
      endReason: this.endReason,
    };
  }

  /** Clients report match outcomes; authority world already handles baseHp. */
  reportChecksum(slot, report) {
    if (slot !== 0 && slot !== 1) return null;
    if (!report || typeof report !== 'object') return null;
    if (report.phase === 'gameover' && (report.winnerSlot === 0 || report.winnerSlot === 1 || report.winnerSlot === null)) {
      if (this.phase !== 'gameover') {
        this.endMatch(
          report.winnerSlot === 0 || report.winnerSlot === 1 ? report.winnerSlot : null,
          report.endReason === 'draw' ? 'draw' : 'base_destroyed',
        );
        return {
          winnerSlot: this.winnerSlot,
          endReason: this.endReason,
        };
      }
    }
    return null;
  }
}

module.exports = {
  AuthoritativeMatch,
  FIXED_DT,
  TICK_MS,
  DISCONNECT_GRACE_MS,
  AUTHORITY_SLOT,
};
