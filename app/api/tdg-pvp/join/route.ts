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
  QUICK_WAITING_STATUS,
} from '@/lib/tdg-pvp';
import { recordMatchStart } from '@/lib/tdg-pvp-activity';
import { mintTdgJoinTicket } from '@/lib/tdg-join-ticket';
import {
  findOpenTftLobby,
  joinTftLobby,
  listTftLobbyMembers,
  startTftLobby,
} from '@/lib/tdg-tft-lobby';
import { sql } from '@/lib/db';

type QueueMode = 'standard' | 'limited' | 'tft' | 'farmers' | 'quick';
/** Modes the pairwise (1v1) matchmaker can start directly. */
type PairMode = 'standard' | 'limited' | 'farmers';

/**
 * Quick Match rolls one of these when it pairs two players who both asked for
 * "anything". Farmers is left out on purpose — it's the peaceful mode.
 */
const QUICK_RANDOM_MODES = ['standard', 'limited', 'tft'] as const;
type QuickRandomMode = (typeof QUICK_RANDOM_MODES)[number];

type WaitingPartner = {
  id: number;
  session_token: string;
  player_name: string;
  status: string;
};

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
  if (mode === 'quick') return 'quick';
  return 'standard';
}

function waitingStatusForMode(mode: QueueMode) {
  if (mode === 'limited') return 'waiting_limited';
  if (mode === 'tft') return 'waiting_tft';
  if (mode === 'farmers') return 'waiting_farmers';
  if (mode === 'quick') return QUICK_WAITING_STATUS;
  return 'waiting';
}

function matchedStatusForMode(mode: PairMode) {
  if (mode === 'limited') return 'matched_limited';
  if (mode === 'farmers') return 'matched_farmers';
  return 'matched';
}

/**
 * Find someone to play against. Quick Match players carry no mode of their own,
 * so every queue except Farmers is allowed to claim them.
 */
async function findLiveWaitingPartner(excludeToken: string | undefined, mode: PairMode) {
  const statuses =
    mode === 'farmers'
      ? ['waiting_farmers']
      : [waitingStatusForMode(mode), QUICK_WAITING_STATUS];

  const waitingRows = (await sql`
    SELECT id, session_token, player_name, status
    FROM tdg_pvp_queue
    WHERE status = ANY(${statuses})
      AND last_seen_at >= NOW() - INTERVAL '30 seconds'
      AND session_token <> ${excludeToken ?? ''}
    ORDER BY created_at ASC
    LIMIT 1
  `) as unknown as WaitingPartner[];
  return waitingRows[0] ?? null;
}

/** Quick Match takes the longest-waiting player from any head-to-head queue. */
async function findQuickWaitingPartner(excludeToken: string) {
  const waitingRows = (await sql`
    SELECT id, session_token, player_name, status
    FROM tdg_pvp_queue
    WHERE status = ANY(${['waiting', 'waiting_limited', QUICK_WAITING_STATUS]})
      AND last_seen_at >= NOW() - INTERVAL '30 seconds'
      AND session_token <> ${excludeToken}
    ORDER BY created_at ASC
    LIMIT 1
  `) as unknown as WaitingPartner[];
  return waitingRows[0] ?? null;
}

/**
 * Join whatever the partner was already queued for, so nobody gets pulled out of
 * the mode they picked. Only when both sides asked for Quick Match do we roll.
 */
function resolveQuickMode(partnerStatus: string): QuickRandomMode {
  if (partnerStatus === 'waiting') return 'standard';
  if (partnerStatus === 'waiting_limited') return 'limited';
  return QUICK_RANDOM_MODES[Math.floor(Math.random() * QUICK_RANDOM_MODES.length)];
}

/**
 * Claim a waiting player and open a 1v1 room. Returns null when someone else got
 * to them first, so the caller can fall back to waiting.
 */
async function pairIntoMatch(params: {
  partner: WaitingPartner;
  sessionToken: string;
  name: string;
  pairMode: PairMode;
}) {
  const { partner, sessionToken, name, pairMode } = params;
  const matchedStatus = matchedStatusForMode(pairMode);
  const isLimited = pairMode === 'limited';
  const isFarmers = pairMode === 'farmers';
  const roomId = makeRoomId();

  const updated = (await sql`
    UPDATE tdg_pvp_queue
    SET status = ${matchedStatus},
        room_id = ${roomId},
        player_slot = 0,
        opponent_name = ${name},
        opponent_token = ${sessionToken},
        last_seen_at = CURRENT_TIMESTAMP
    WHERE id = ${partner.id}
      AND status = ${partner.status}
      AND last_seen_at >= NOW() - INTERVAL '30 seconds'
    RETURNING session_token, player_name
  `) as unknown as Array<{ session_token: string; player_name: string }>;

  if (!updated[0]) return null;
  const opponent = updated[0];

  await recordMatchStart(roomId, opponent.player_name, name);

  await sql`
    INSERT INTO tdg_pvp_queue (
      session_token, player_name, status, room_id, player_slot, opponent_name, opponent_token, last_seen_at
    ) VALUES (
      ${sessionToken}, ${name}, ${matchedStatus}, ${roomId}, 1, ${opponent.player_name}, ${opponent.session_token}, CURRENT_TIMESTAMP
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

  const startsAt = Date.now() + 4500;

  const hostTicket = isFarmers
    ? null
    : mintTdgJoinTicket({
        roomId,
        sessionToken: opponent.session_token,
        playerSlot: 0,
        playerName: opponent.player_name,
        opponentName: name,
        startsAt,
      });
  const guestTicket = isFarmers
    ? null
    : mintTdgJoinTicket({
        roomId,
        sessionToken,
        playerSlot: 1,
        playerName: name,
        opponentName: opponent.player_name,
        startsAt,
      });

  await Promise.all([
    safeTrigger(`tdg-player-${opponent.session_token}`, 'match_found', {
      roomId,
      startsAt,
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
      roomId,
      startsAt,
      playerId: 1,
      opponentName: opponent.player_name,
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
    opponentName: opponent.player_name,
    isHost: false,
    playerName: name,
    startsAt,
    joinTicket: guestTicket,
    serverAuth: Boolean(guestTicket),
    limited: isLimited,
    tft: false,
    farmers: isFarmers,
  });
}

/**
 * Quick Match rolled TFT: seat both players in a fresh lobby and start it right
 * away. The remaining seats autofill with CPUs on the client.
 */
async function pairIntoTftMatch(params: {
  partner: WaitingPartner;
  sessionToken: string;
  name: string;
}) {
  const { partner, sessionToken, name } = params;
  const roomId = makeRoomId();

  const updated = (await sql`
    UPDATE tdg_pvp_queue
    SET status = 'waiting_tft',
        room_id = ${roomId},
        player_slot = 0,
        opponent_name = NULL,
        opponent_token = NULL,
        last_seen_at = CURRENT_TIMESTAMP
    WHERE id = ${partner.id}
      AND status = ${partner.status}
      AND last_seen_at >= NOW() - INTERVAL '30 seconds'
    RETURNING session_token, player_name
  `) as unknown as Array<{ session_token: string; player_name: string }>;

  if (!updated[0]) return null;
  const host = updated[0];

  await sql`
    INSERT INTO tdg_pvp_queue (
      session_token, player_name, status, room_id, player_slot, opponent_name, opponent_token, last_seen_at
    ) VALUES (
      ${sessionToken}, ${name}, 'waiting_tft', ${roomId}, 1, NULL, NULL, CURRENT_TIMESTAMP
    )
    ON CONFLICT (session_token) DO UPDATE SET
      player_name = EXCLUDED.player_name,
      status = EXCLUDED.status,
      room_id = EXCLUDED.room_id,
      player_slot = EXCLUDED.player_slot,
      opponent_name = NULL,
      opponent_token = NULL,
      created_at = CURRENT_TIMESTAMP,
      last_seen_at = CURRENT_TIMESTAMP
  `;

  // Slot 0 is the lobby host, so start on their behalf; this also broadcasts
  // match_found to everyone in the room, including us.
  const started = await startTftLobby(roomId, host.session_token);
  const members = await listTftLobbyMembers(roomId);

  return NextResponse.json({
    status: 'matched',
    sessionToken,
    roomId,
    playerId: 1,
    opponentName: members
      .filter((m) => m.sessionToken !== sessionToken)
      .map((m) => m.playerName)
      .join(', '),
    isHost: false,
    playerName: name,
    startsAt: started.startsAt,
    joinTicket: null,
    serverAuth: false,
    limited: false,
    tft: true,
    farmers: false,
    roster: members.map((m) => ({ slot: m.playerSlot, name: m.playerName })),
    lobby: started.lobby,
  });
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

    if (!opponent || !opponentAlive) {
      await removeQueueSession(existingToken);
      return null;
    }

    await touchQueueSession(existingToken);

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
    row.status === 'waiting_farmers' ||
    row.status === QUICK_WAITING_STATUS
  ) {
    await touchQueueSession(existingToken);
    return NextResponse.json({
      status: 'waiting',
      sessionToken: row.session_token,
      playerName: row.player_name,
      limited: row.status === 'waiting_limited',
      tft: false,
      farmers: row.status === 'waiting_farmers',
      quick: row.status === QUICK_WAITING_STATUS,
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
    const isQuick = queueMode === 'quick';

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

    if (isQuick) {
      const partner = await findQuickWaitingPartner(sessionToken);
      if (partner) {
        const rolled = resolveQuickMode(partner.status);
        const paired =
          rolled === 'tft'
            ? await pairIntoTftMatch({ partner, sessionToken, name })
            : await pairIntoMatch({ partner, sessionToken, name, pairMode: rolled });
        if (paired) return paired;
      }

      // Nobody head-to-head, but an open TFT lobby still counts as "a game to join".
      if (await findOpenTftLobby()) {
        return NextResponse.json(await joinTftLobby({ name, sessionToken }));
      }
    } else {
      const pairMode: PairMode = isFarmers ? 'farmers' : isLimited ? 'limited' : 'standard';
      const partner = await findLiveWaitingPartner(sessionToken, pairMode);
      if (partner) {
        const paired = await pairIntoMatch({ partner, sessionToken, name, pairMode });
        if (paired) return paired;
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
      quick: isQuick,
    });
  } catch (error) {
    console.error('tdg-pvp join error:', error);
    return NextResponse.json({ error: 'Could not join queue.' }, { status: 500 });
  }
}
