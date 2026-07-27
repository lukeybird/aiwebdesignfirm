import { NextRequest, NextResponse } from 'next/server';
import {
  cleanupStaleTdgQueue,
  ensureTdgPvpTables,
  findQueueRowByRoomAndToken,
  findQueueRowByToken,
  getMatchState,
  isQueueSessionAlive,
  matchedModeFlags,
  touchQueueSession,
} from '@/lib/tdg-pvp';
import { mintTdgJoinTicket } from '@/lib/tdg-join-ticket';

/**
 * Rejoin an active match by room id + session token (from ?game= URL).
 * Does not rematchmake and never deletes the room on failure.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      roomId?: string;
      sessionToken?: string;
      mode?: string;
    };

    const roomId = typeof body.roomId === 'string' ? body.roomId.trim().slice(0, 64) : '';
    const sessionToken =
      typeof body.sessionToken === 'string' ? body.sessionToken.trim().slice(0, 64) : '';

    if (!roomId || !sessionToken) {
      return NextResponse.json({ error: 'Missing game id or session.' }, { status: 400 });
    }

    await ensureTdgPvpTables();
    await cleanupStaleTdgQueue();

    let row = await findQueueRowByRoomAndToken(roomId, sessionToken);
    if (!row) {
      // Token still valid for this room under a slightly stale lookup path.
      const byToken = await findQueueRowByToken(sessionToken);
      if (byToken?.room_id === roomId) row = byToken;
    }

    if (!row || !row.room_id || row.player_slot === null) {
      return NextResponse.json({ error: 'Game not found or session expired.' }, { status: 404 });
    }

    if (!['matched', 'matched_limited', 'matched_tft'].includes(row.status)) {
      return NextResponse.json({ error: 'Game is no longer active.' }, { status: 410 });
    }

    const opponent = row.opponent_token ? await findQueueRowByToken(row.opponent_token) : null;
    const opponentAlive = opponent ? await isQueueSessionAlive(opponent) : false;
    const snap = await getMatchState(roomId);

    // Allow rejoin if opponent is still in the room, or we at least have a saved snapshot
    // while the room rows still exist (host may be mid-refresh).
    if (!opponent || (!opponentAlive && !snap)) {
      return NextResponse.json(
        { error: 'Opponent left or the match timed out.' },
        { status: 410 },
      );
    }

    await touchQueueSession(sessionToken);
    if (opponent.session_token) await touchQueueSession(opponent.session_token);

    const startsAt = Date.now() + 1200;
    const joinTicket =
      row.player_slot === 0 || row.player_slot === 1
        ? mintTdgJoinTicket({
            roomId: row.room_id,
            sessionToken: row.session_token,
            playerSlot: row.player_slot as 0 | 1,
            playerName: row.player_name,
            opponentName: row.opponent_name || undefined,
            startsAt,
          })
        : null;

    const flags = matchedModeFlags(row.status);
    const stateMode = snap?.mode;
    const limited = flags.limited || stateMode === 'limited' || stateMode === 'limited_draft';
    const tft = flags.tft || stateMode === 'tft';

    return NextResponse.json({
      status: 'matched',
      resume: true,
      sessionToken: row.session_token,
      roomId: row.room_id,
      playerId: row.player_slot,
      opponentName: row.opponent_name,
      isHost: row.player_slot === 0,
      playerName: row.player_name,
      startsAt,
      joinTicket,
      serverAuth: Boolean(joinTicket),
      limited,
      tft,
      state: snap?.state ?? null,
      stateUpdatedAt: snap?.updated_at ?? null,
    });
  } catch (error) {
    console.error('tdg-pvp rejoin error:', error);
    return NextResponse.json({ error: 'Could not rejoin game.' }, { status: 500 });
  }
}
