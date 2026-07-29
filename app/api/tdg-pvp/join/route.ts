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
import { joinTftLobby } from '@/lib/tdg-tft-lobby';
import { sql } from '@/lib/db';

type QueueMode = 'standard' | 'limited' | 'tft' | 'farmers';

function makeToken() {
  return randomBytes(24).toString('hex');
}

function makeRoomId() {
  return randomBytes(12).toString('hex');
}

function normalizeQueueMode(mode?: string): QueueMode {
  if (mode === 'limited') return 'limited';
  if (mode === 'tft') return 'tft';
  if (mode === 'farmers') return 'farmers';
  return 'standard';
}

function waitingStatusForMode(mode: QueueMode) {
  if (mode === 'limited') return 'waiting_limited';
  if (mode === 'tft') return 'waiting_tft';
  if (mode === 'farmers') return 'waiting_farmers';
  return 'waiting';
}

function matchedStatusForMode(mode: 'standard' | 'limited' | 'farmers') {
  if (mode === 'limited') return 'matched_limited';
  if (mode === 'farmers') return 'matched_farmers';
  return 'matched';
}

async function findLiveWaitingPartner(
  excludeToken: string | undefined,
  mode: 'standard' | 'limited' | 'farmers',
) {
  const waitingStatus = waitingStatusForMode(mode);
  const waitingRows = (await sql`
    SELECT id, session_token, player_name
    FROM tdg_pvp_queue
    WHERE status = ${waitingStatus}
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

  // TFT lobbies / matches resume through joinTftLobby.
  if (row.status === 'waiting_tft' || row.status === 'matched_tft') {
    return null;
  }

  if (
    (row.status === 'matched' ||
      row.status === 'matched_limited' ||
      row.status === 'matched_farmers') &&
    row.room_id &&
    row.player_slot !== null
  ) {
    const opponent = row.opponent_token
      ? await findQueueRowByToken(row.opponent_token)
      : null;
    const opponentAlive = opponent ? await isQueueSessionAlive(opponent) : false;

    if (!opponent) {
      await removeQueueSession(existingToken);
      return null;
    }

    await touchQueueSession(existingToken);
    if (opponent.session_token) await touchQueueSession(opponent.session_token);

    const startsAt = Date.now() + 4500;
    const isFarmers = row.status === 'matched_farmers';
    const joinTicket =
      !isFarmers &&
      row.room_id &&
      (row.player_slot === 0 || row.player_slot === 1)
        ? mintTdgJoinTicket({
            roomId: row.room_id,
            sessionToken: row.session_token,
            playerSlot: row.player_slot,
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
      limited: row.status === 'matched_limited',
      tft: false,
      farmers: isFarmers,
      opponentAlive,
    });
  }

  if (
    row.status === 'waiting' ||
    row.status === 'waiting_limited' ||
    row.status === 'waiting_farmers'
  ) {
    await touchQueueSession(existingToken);
    return NextResponse.json({
      status: 'waiting',
      sessionToken: row.session_token,
      playerName: row.player_name,
      limited: row.status === 'waiting_limited',
      tft: false,
      farmers: row.status === 'waiting_farmers',
    });
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { name?: string; sessionToken?: string; mode?: string };
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 32) : '';
    const existingToken =
      typeof body.sessionToken === 'string' ? body.sessionToken.trim().slice(0, 64) : '';
    const queueMode = normalizeQueueMode(body.mode);
    const waitingStatus = waitingStatusForMode(queueMode);
    const isLimited = queueMode === 'limited';
    const isTft = queueMode === 'tft';
    const isFarmers = queueMode === 'farmers';

    if (!name || name.length < 2) {
      return NextResponse.json({ error: 'Enter a name (at least 2 characters).' }, { status: 400 });
    }

    await ensureTdgPvpTables();
    await cleanupStaleTdgQueue();

    const sessionToken = existingToken || makeToken();

    // TFT uses 2–4 player lobbies (League-style), not pairwise matchmaking.
    if (isTft) {
      const tft = await joinTftLobby({ name, sessionToken });
      return NextResponse.json(tft);
    }

    if (existingToken) {
      const resumed = await tryResumeExistingSession(existingToken);
      if (resumed) return resumed;
    }

    const pairMode: 'standard' | 'limited' | 'farmers' = isFarmers
      ? 'farmers'
      : isLimited
        ? 'limited'
        : 'standard';
    const matchedStatus = matchedStatusForMode(pairMode);
    const waiting = await findLiveWaitingPartner(sessionToken, pairMode);
    if (waiting) {
      const roomId = makeRoomId();
      const updated = (await sql`
        UPDATE tdg_pvp_queue
        SET status = ${matchedStatus},
            room_id = ${roomId},
            player_slot = 0,
            opponent_name = ${name},
            opponent_token = ${sessionToken},
            last_seen_at = CURRENT_TIMESTAMP
        WHERE id = ${waiting.id}
          AND status = ${waitingStatus}
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
            ${sessionToken}, ${name}, ${matchedStatus}, ${roomId}, 1, ${partner.player_name}, ${partner.session_token}, CURRENT_TIMESTAMP
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

        const hostTicket = isFarmers
          ? null
          : mintTdgJoinTicket({
              roomId,
              sessionToken: partner.session_token,
              playerSlot: 0,
              playerName: partner.player_name,
              opponentName: name,
              startsAt: matchPayload.startsAt,
            });
        const guestTicket = isFarmers
          ? null
          : mintTdgJoinTicket({
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
            limited: isLimited,
            tft: false,
            farmers: isFarmers,
          }),
          safeTrigger(`tdg-player-${sessionToken}`, 'match_found', {
            ...matchPayload,
            playerId: 1,
            opponentName: partner.player_name,
            isHost: false,
            joinTicket: guestTicket,
            serverAuth: Boolean(guestTicket),
            limited: isLimited,
            tft: false,
            farmers: isFarmers,
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
          limited: isLimited,
          tft: false,
          farmers: isFarmers,
        });
      }
    }

    await sql`
      INSERT INTO tdg_pvp_queue (session_token, player_name, status, last_seen_at)
      VALUES (${sessionToken}, ${name}, ${waitingStatus}, CURRENT_TIMESTAMP)
      ON CONFLICT (session_token) DO UPDATE SET
        player_name = EXCLUDED.player_name,
        status = ${waitingStatus},
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
      limited: isLimited,
      tft: false,
      farmers: isFarmers,
    });
  } catch (error) {
    console.error('tdg-pvp join error:', error);
    return NextResponse.json({ error: 'Could not join queue.' }, { status: 500 });
  }
}
