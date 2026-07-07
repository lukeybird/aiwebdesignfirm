import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { pusher } from '@/lib/pusher';
import {
  cleanupStaleTdgQueue,
  ensureTdgPvpTables,
  type TdgQueueRow,
} from '@/lib/tdg-pvp';
import { sql } from '@/lib/db';

function makeToken() {
  return randomBytes(24).toString('hex');
}

function makeRoomId() {
  return randomBytes(12).toString('hex');
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
      const existing = (await sql`
        SELECT session_token, player_name, status, room_id, player_slot, opponent_name
        FROM tdg_pvp_queue
        WHERE session_token = ${existingToken}
        LIMIT 1
      `) as unknown as TdgQueueRow[];

      const row = existing[0];
      if (row?.status === 'matched' && row.room_id && row.player_slot !== null) {
        return NextResponse.json({
          status: 'matched',
          sessionToken: row.session_token,
          roomId: row.room_id,
          playerId: row.player_slot,
          opponentName: row.opponent_name,
          isHost: row.player_slot === 0,
          playerName: row.player_name,
        });
      }
      if (row?.status === 'waiting') {
        return NextResponse.json({
          status: 'waiting',
          sessionToken: row.session_token,
          playerName: row.player_name,
        });
      }
    }

    const waitingRows = (await sql`
      SELECT id, session_token, player_name
      FROM tdg_pvp_queue
      WHERE status = 'waiting'
      ORDER BY created_at ASC
      LIMIT 1
    `) as unknown as Array<{ id: number; session_token: string; player_name: string }>;

    const waiting = waitingRows[0];
    if (waiting) {
      const roomId = makeRoomId();
      const updated = (await sql`
        UPDATE tdg_pvp_queue
        SET status = 'matched',
            room_id = ${roomId},
            player_slot = 0,
            opponent_name = ${name},
            opponent_token = ${sessionToken}
        WHERE id = ${waiting.id}
          AND status = 'waiting'
        RETURNING session_token, player_name
      `) as unknown as Array<{ session_token: string; player_name: string }>;

      if (updated[0]) {
        const partner = updated[0];

        await sql`
          INSERT INTO tdg_pvp_queue (
            session_token, player_name, status, room_id, player_slot, opponent_name, opponent_token
          ) VALUES (
            ${sessionToken}, ${name}, 'matched', ${roomId}, 1, ${partner.player_name}, ${partner.session_token}
          )
          ON CONFLICT (session_token) DO UPDATE SET
            player_name = EXCLUDED.player_name,
            status = EXCLUDED.status,
            room_id = EXCLUDED.room_id,
            player_slot = EXCLUDED.player_slot,
            opponent_name = EXCLUDED.opponent_name,
            opponent_token = EXCLUDED.opponent_token
        `;

        const matchPayload = {
          roomId,
          startsAt: Date.now() + 4500,
        };

        await Promise.all([
          pusher.trigger(`tdg-player-${partner.session_token}`, 'match_found', {
            ...matchPayload,
            playerId: 0,
            opponentName: name,
            isHost: true,
          }),
          pusher.trigger(`tdg-player-${sessionToken}`, 'match_found', {
            ...matchPayload,
            playerId: 1,
            opponentName: partner.player_name,
            isHost: false,
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
        });
      }
    }

    await sql`
      INSERT INTO tdg_pvp_queue (session_token, player_name, status)
      VALUES (${sessionToken}, ${name}, 'waiting')
      ON CONFLICT (session_token) DO UPDATE SET
        player_name = EXCLUDED.player_name,
        status = 'waiting',
        room_id = NULL,
        player_slot = NULL,
        opponent_name = NULL,
        opponent_token = NULL,
        created_at = CURRENT_TIMESTAMP
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
