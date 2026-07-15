'use strict';

const crypto = require('crypto');
const { Pool } = require('pg');

const JOIN_SECRET = process.env.TDG_JOIN_SECRET || '';
const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';

let pool = null;

function getPool() {
  if (!DATABASE_URL) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
      max: 5,
    });
  }
  return pool;
}

function b64url(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function b64urlJson(obj) {
  return b64url(JSON.stringify(obj));
}

function fromB64url(str) {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + pad;
  return Buffer.from(b64, 'base64').toString('utf8');
}

function signPayload(payloadB64) {
  if (!JOIN_SECRET) {
    throw new Error('TDG_JOIN_SECRET is required to mint/verify tickets');
  }
  return crypto.createHmac('sha256', JOIN_SECRET).update(payloadB64).digest('base64url');
}

/**
 * Mint a short-lived join ticket (also used by Vercel via shared secret).
 * @param {{ roomId: string, sessionToken: string, playerSlot: number, playerName: string, opponentName?: string, startsAt?: number }} claims
 */
function mintJoinTicket(claims, ttlMs = 120_000) {
  const payload = {
    roomId: claims.roomId,
    sessionToken: claims.sessionToken,
    playerSlot: claims.playerSlot,
    playerName: claims.playerName,
    opponentName: claims.opponentName || '',
    startsAt: claims.startsAt || Date.now() + 4500,
    exp: Date.now() + ttlMs,
  };
  const payloadB64 = b64urlJson(payload);
  const sig = signPayload(payloadB64);
  return `${payloadB64}.${sig}`;
}

function verifyJoinTicket(ticket) {
  if (!ticket || typeof ticket !== 'string' || !ticket.includes('.')) {
    return { ok: false, error: 'Invalid ticket format' };
  }
  if (!JOIN_SECRET) {
    return { ok: false, error: 'Server missing TDG_JOIN_SECRET' };
  }
  const [payloadB64, sig] = ticket.split('.');
  const expected = signPayload(payloadB64);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, error: 'Bad ticket signature' };
  }
  let payload;
  try {
    payload = JSON.parse(fromB64url(payloadB64));
  } catch {
    return { ok: false, error: 'Bad ticket payload' };
  }
  if (!payload.roomId || !payload.sessionToken || (payload.playerSlot !== 0 && payload.playerSlot !== 1)) {
    return { ok: false, error: 'Incomplete ticket claims' };
  }
  if (typeof payload.exp === 'number' && Date.now() > payload.exp) {
    return { ok: false, error: 'Ticket expired' };
  }
  return { ok: true, claims: payload };
}

/**
 * Fallback: verify session token against shared Postgres queue table.
 */
async function verifySessionInDb(roomId, sessionToken) {
  const db = getPool();
  if (!db) return null;
  const result = await db.query(
    `SELECT session_token, player_name, player_slot, opponent_name, room_id, status
     FROM tdg_pvp_queue
     WHERE room_id = $1 AND session_token = $2 AND status = 'matched'
     LIMIT 1`,
    [roomId, sessionToken],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    roomId: row.room_id,
    sessionToken: row.session_token,
    playerSlot: row.player_slot,
    playerName: row.player_name,
    opponentName: row.opponent_name || '',
  };
}

/**
 * Authenticate a join message: prefer HMAC ticket, fall back to DB.
 */
async function authenticateJoin({ ticket, roomId, sessionToken }) {
  if (ticket) {
    const verified = verifyJoinTicket(ticket);
    if (!verified.ok) return verified;
    return { ok: true, claims: verified.claims };
  }

  if (roomId && sessionToken) {
    try {
      const fromDb = await verifySessionInDb(roomId, sessionToken);
      if (fromDb) {
        return {
          ok: true,
          claims: {
            ...fromDb,
            startsAt: Date.now() + 3000,
            exp: Date.now() + 120_000,
          },
        };
      }
    } catch (err) {
      console.error('DB join verify failed:', err.message);
    }
  }

  return { ok: false, error: 'Unauthorized join' };
}

module.exports = {
  mintJoinTicket,
  verifyJoinTicket,
  authenticateJoin,
  JOIN_SECRET,
};
