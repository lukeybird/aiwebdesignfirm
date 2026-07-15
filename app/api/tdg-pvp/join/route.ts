import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { safeTrigger } from '@/lib/pusher';
import {
  cleanupStaleTdgQueue,
  ensureTdgPvpTables,
  findQueueRowByToken,
  isQueueSessionAlive,
  removeQueueSession,
  touchQueueSession,
} from '@/lib/tdg-pvp';
import { recordMatchStart } from '@/lib/tdg-pvp-activity';
import { mintTdgJoinTicket } from '@/lib/tdg-join-ticket';
import { sql } from '@/lib/db';

function makeToken() {
  return randomBytes(24).toString('hex');
}

function makeRoomId() {
  return randomBytes(12).toString('hex');
}

async function findLiveWaitingPartner(excludeToken?: string) {
  const waitingRows = (await sql`
    SELECT id, session_token, player_name
    FROM tdg_pvp_queue
    WHERE status = 'waiting'
      AND last_seen_at >= NOW() - INTERVAL '30 seconds'
      AND session_token <> ${excludeToken ?? ''}
    ORDER BY created_at ASC
    LIMIT 1
  `) as unknown as Array<{ id: number; session_token: string; player_name: string }>;
  return waitingRows[0] ?? null;
}

async function tryResumeExistingSession(existingToken: string) {
  const row = await findQueueRowByToken(existingToken);
  if (!row) return null;

  if (row.status === 'matched' && row.room_id && row.player_slot !== null) {
    const opponent = row.opponent_token
      ? await findQueueRowByToken(row.opponent_token)
      : null;
    const opponentAlive = opponent ? await isQueueSessionAlive(opponent) : false;

    if (!opponentAlive) {
      await removeQueueSession(existingToken);
      return null;
    }

    await touchQueueSession(existingToken);
    if (opponent?.session_token) await touchQueueSession(opponent.session_token);

    const startsAt = Date.now() + 4500;
    const joinTicket =
      row.room_id && (row.player_slot === 0 || row.player_slot === 1)
        ? mintTdgJoinTicket({
            roomId: row.room_id,
            sessionToken: row.session_token,
            playerSlot: row.player_slot as 0 | 1,
            playerName: row.player_name,
            opponentName: row.opponent_name || undefined,
            startsAt,
          })
        : null;

    return NextResponse.json({
      status: 'matched',
      sessionToken: row.session_token,
      roomId: row.room_id,
      playerId: row.player_slot,
      opponentName: row.opponent_name,
      isHost: row.player_slot === 0,
      playerName: row.player_name,
      startsAt,
      joinTicket,
      serverAuth: Boolean(joinTicket),
    });
  }

  if (row.status === 'waiting') {
    await touchQueueSession(existingToken);
    return NextResponse.json({
      status: 'waiting',
      sessionToken: row.session_token,
      playerName: row.player_name,
    });
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { name?: string; sessionToken?: string };
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 32) : '';
    const existingToken =
      typeof body.sessionToken === 'string' ? body.sessionToken.trim().slice(0, 64) : '';

    if (!name || name.length < 2) {
      return NextResponse.json({ error: 'Enter a name (at least 2 characters).' }, { status: 400 });
    }

    await ensureTdgPvpTables();
    await cleanupStaleTdgQueue();

    const sessionToken = existingToken || makeToken();

    if (existingToken) {
      const resumed = await tryResumeExistingSession(existingToken);
      if (resumed) return resumed;
    }

    const waiting = await findLiveWaitingPartner(sessionToken);
    if (waiting) {
      const roomId = makeRoomId();
      const updated = (await sql`
        UPDATE tdg_pvp_queue
        SET status = 'matched',
            room_id = ${roomId},
            player_slot = 0,
            opponent_name = ${name},
            opponent_token = ${sessionToken},
            last_seen_at = CURRENT_TIMESTAMP
        WHERE id = ${waiting.id}
          AND status = 'waiting'
          AND last_seen_at >= NOW() - INTERVAL '30 seconds'
        RETURNING session_token, player_name
      `) as unknown as Array<{ session_token: string; player_name: string }>;

      if (updated[0]) {
        const partner = updated[0];

        await recordMatchStart(roomId, partner.player_name, name);

        await sql`
          INSERT INTO tdg_pvp_queue (
            session_token, player_name, status, room_id, player_slot, opponent_name, opponent_token, last_seen_at
          ) VALUES (
            ${sessionToken}, ${name}, 'matched', ${roomId}, 1, ${partner.player_name}, ${partner.session_token}, CURRENT_TIMESTAMP
          )
          ON CONFLICT (session_token) DO UPDATE SET
            player_name = EXCLUDED.player_name,
            status = EXCLUDED.status,
            room_id = EXCLUDED.room_id,
            player_slot = EXCLUDED.player_slot,
            opponent_name = EXCLUDED.opponent_name,
            opponent_token = EXCLUDED.opponent_token,
            last_seen_at = CURRENT_TIMESTAMP
        `;

        const matchPayload = {
          roomId,
          startsAt: Date.now() + 4500,
        };

        const hostTicket = mintTdgJoinTicket({
          roomId,
          sessionToken: partner.session_token,
          playerSlot: 0,
          playerName: partner.player_name,
          opponentName: name,
          startsAt: matchPayload.startsAt,
        });
        const guestTicket = mintTdgJoinTicket({
          roomId,
          sessionToken,
          playerSlot: 1,
          playerName: name,
          opponentName: partner.player_name,
          startsAt: matchPayload.startsAt,
        });

        await Promise.all([
          safeTrigger(`tdg-player-${partner.session_token}`, 'match_found', {
            ...matchPayload,
            playerId: 0,
            opponentName: name,
            isHost: true,
            joinTicket: hostTicket,
            serverAuth: Boolean(hostTicket),
          }),
          safeTrigger(`tdg-player-${sessionToken}`, 'match_found', {
            ...matchPayload,
            playerId: 1,
            opponentName: partner.player_name,
            isHost: false,
            joinTicket: guestTicket,
            serverAuth: Boolean(guestTicket),
          }),
        ]);

        return NextResponse.json({
          status: 'matched',
          sessionToken,
          roomId,
          playerId: 1,
          opponentName: partner.player_name,
          isHost: false,
          playerName: name,
          startsAt: matchPayload.startsAt,
          joinTicket: guestTicket,
          serverAuth: Boolean(guestTicket),
        });
      }
    }

    await sql`
      INSERT INTO tdg_pvp_queue (session_token, player_name, status, last_seen_at)
      VALUES (${sessionToken}, ${name}, 'waiting', CURRENT_TIMESTAMP)
      ON CONFLICT (session_token) DO UPDATE SET
        player_name = EXCLUDED.player_name,
        status = 'waiting',
        room_id = NULL,
        player_slot = NULL,
        opponent_name = NULL,
        opponent_token = NULL,
        created_at = CURRENT_TIMESTAMP,
        last_seen_at = CURRENT_TIMESTAMP
    `;

    return NextResponse.json({
      status: 'waiting',
      sessionToken,
      playerName: name,
    });
  } catch (error) {
    console.error('tdg-pvp join error:', error);
    return NextResponse.json({ error: 'Could not join queue.' }, { status: 500 });
  }
}
