import { createHash, randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { sql } from '@/lib/db';

export type BabyRole = 'host' | 'viewer';

export type BabySession = {
  roomId: number;
  roomCode: string;
  channelName: string;
  clientId: string;
  role: BabyRole;
};

let initPromise: Promise<void> | null = null;

function tokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function makeToken(bytes = 32) {
  return randomBytes(bytes).toString('hex');
}

function makeRoomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(6);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
}

export function validPin(pin: string) {
  return /^\d{4,8}$/.test(pin);
}

export async function ensureBabyMonitorTables() {
  if (!initPromise) {
    initPromise = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS baby_monitor_rooms (
          id BIGSERIAL PRIMARY KEY,
          room_code VARCHAR(12) UNIQUE NOT NULL,
          channel_name VARCHAR(96) UNIQUE NOT NULL,
          pin_hash TEXT NOT NULL,
          active BOOLEAN NOT NULL DEFAULT TRUE,
          failed_attempts INTEGER NOT NULL DEFAULT 0,
          lock_until TIMESTAMP,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          host_last_seen TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMP NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '12 hours')
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS baby_monitor_sessions (
          id BIGSERIAL PRIMARY KEY,
          room_id BIGINT NOT NULL REFERENCES baby_monitor_rooms(id) ON DELETE CASCADE,
          token_hash VARCHAR(64) UNIQUE NOT NULL,
          client_id VARCHAR(64) NOT NULL,
          role VARCHAR(12) NOT NULL CHECK (role IN ('host', 'viewer')),
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMP NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '12 hours')
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS idx_baby_sessions_room ON baby_monitor_sessions(room_id, last_seen_at)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_baby_rooms_code ON baby_monitor_rooms(room_code)`;
    })().catch((error) => {
      initPromise = null;
      throw error;
    });
  }
  return initPromise;
}

export async function cleanupBabyMonitorRooms() {
  await ensureBabyMonitorTables();
  await sql`
    UPDATE baby_monitor_rooms
    SET active = FALSE
    WHERE active = TRUE
      AND (expires_at < CURRENT_TIMESTAMP OR host_last_seen < CURRENT_TIMESTAMP - INTERVAL '90 seconds')
  `;
  await sql`DELETE FROM baby_monitor_sessions WHERE expires_at < CURRENT_TIMESTAMP`;
}

export async function createBabyRoom(pin: string) {
  await ensureBabyMonitorTables();
  await cleanupBabyMonitorRooms();

  const pinHash = await bcrypt.hash(pin, 11);
  const channelName = `private-baby-${makeToken(18)}`;
  let roomCode = '';
  let room: Array<{ id: number }> = [];

  for (let attempt = 0; attempt < 8 && room.length === 0; attempt += 1) {
    roomCode = makeRoomCode();
    room = (await sql`
      INSERT INTO baby_monitor_rooms (room_code, channel_name, pin_hash)
      VALUES (${roomCode}, ${channelName}, ${pinHash})
      ON CONFLICT (room_code) DO NOTHING
      RETURNING id
    `) as unknown as Array<{ id: number }>;
  }
  if (!room[0]) throw new Error('Could not allocate a room code.');

  const token = makeToken();
  const clientId = `host-${makeToken(8)}`;
  await sql`
    INSERT INTO baby_monitor_sessions (room_id, token_hash, client_id, role)
    VALUES (${room[0].id}, ${tokenHash(token)}, ${clientId}, 'host')
  `;

  return { roomCode, channelName, token, clientId, role: 'host' as const };
}

export async function joinBabyRoom(roomCodeInput: string, pin: string) {
  await ensureBabyMonitorTables();
  await cleanupBabyMonitorRooms();
  const roomCode = roomCodeInput.trim().toUpperCase();
  const rows = (await sql`
    SELECT id, room_code, channel_name, pin_hash, failed_attempts,
           lock_until, host_last_seen
    FROM baby_monitor_rooms
    WHERE room_code = ${roomCode}
      AND active = TRUE
      AND expires_at > CURRENT_TIMESTAMP
    LIMIT 1
  `) as unknown as Array<{
    id: number;
    room_code: string;
    channel_name: string;
    pin_hash: string;
    failed_attempts: number;
    lock_until: Date | null;
    host_last_seen: Date;
  }>;
  const room = rows[0];
  if (!room) return { error: 'Room not found or no longer active.', status: 404 } as const;
  if (room.lock_until && new Date(room.lock_until).getTime() > Date.now()) {
    return { error: 'Too many incorrect attempts. Try again shortly.', status: 429 } as const;
  }
  if (Date.now() - new Date(room.host_last_seen).getTime() > 90_000) {
    await sql`UPDATE baby_monitor_rooms SET active = FALSE WHERE id = ${room.id}`;
    return { error: 'The camera device is no longer online.', status: 410 } as const;
  }

  const accepted = await bcrypt.compare(pin, room.pin_hash);
  if (!accepted) {
    const failures = (room.failed_attempts || 0) + 1;
    await sql`
      UPDATE baby_monitor_rooms
      SET failed_attempts = ${failures},
          lock_until = CASE
            WHEN ${failures} >= 5 THEN CURRENT_TIMESTAMP + INTERVAL '60 seconds'
            ELSE NULL
          END
      WHERE id = ${room.id}
    `;
    return { error: 'Incorrect room code or PIN.', status: 401 } as const;
  }

  await sql`UPDATE baby_monitor_rooms SET failed_attempts = 0, lock_until = NULL WHERE id = ${room.id}`;
  const token = makeToken();
  const clientId = `viewer-${makeToken(8)}`;
  await sql`
    INSERT INTO baby_monitor_sessions (room_id, token_hash, client_id, role)
    VALUES (${room.id}, ${tokenHash(token)}, ${clientId}, 'viewer')
  `;
  return {
    roomCode: room.room_code,
    channelName: room.channel_name,
    token,
    clientId,
    role: 'viewer' as const,
  };
}

export async function verifyBabySession(token: string): Promise<BabySession | null> {
  if (!/^[a-f0-9]{64}$/i.test(token)) return null;
  await ensureBabyMonitorTables();
  const rows = (await sql`
    SELECT r.id AS room_id, r.room_code, r.channel_name,
           s.client_id, s.role
    FROM baby_monitor_sessions s
    JOIN baby_monitor_rooms r ON r.id = s.room_id
    WHERE s.token_hash = ${tokenHash(token)}
      AND s.expires_at > CURRENT_TIMESTAMP
      AND r.active = TRUE
      AND r.expires_at > CURRENT_TIMESTAMP
    LIMIT 1
  `) as unknown as Array<{
    room_id: number;
    room_code: string;
    channel_name: string;
    client_id: string;
    role: BabyRole;
  }>;
  const row = rows[0];
  return row
    ? {
        roomId: row.room_id,
        roomCode: row.room_code,
        channelName: row.channel_name,
        clientId: row.client_id,
        role: row.role,
      }
    : null;
}

export async function touchBabySession(session: BabySession) {
  await sql`
    UPDATE baby_monitor_sessions
    SET last_seen_at = CURRENT_TIMESTAMP
    WHERE room_id = ${session.roomId} AND client_id = ${session.clientId}
  `;
  if (session.role === 'host') {
    await sql`
      UPDATE baby_monitor_rooms
      SET host_last_seen = CURRENT_TIMESTAMP
      WHERE id = ${session.roomId} AND active = TRUE
    `;
  }
  const viewers = (await sql`
    SELECT COUNT(*)::int AS count
    FROM baby_monitor_sessions
    WHERE room_id = ${session.roomId}
      AND role = 'viewer'
      AND last_seen_at > CURRENT_TIMESTAMP - INTERVAL '40 seconds'
  `) as unknown as Array<{ count: number }>;
  return viewers[0]?.count ?? 0;
}

export async function closeBabyRoom(session: BabySession) {
  if (session.role !== 'host') return false;
  await sql`UPDATE baby_monitor_rooms SET active = FALSE WHERE id = ${session.roomId}`;
  return true;
}
