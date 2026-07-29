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
import { listTftLobbyMembers } from '@/lib/tdg-tft-lobby';
import { sql } from '@/lib/db';

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
      const byToken = await findQueueRowByToken(sessionToken);
      if (byToken?.room_id === roomId) row = byToken;
    }

    if (!row || !row.room_id || row.player_slot === null) {
      return NextResponse.json({ error: 'Game not found or session expired.' }, { status: 404 });
    }

    if (!['matched', 'matched_limited', 'matched_tft', 'matched_farmers'].includes(row.status)) {
      return NextResponse.json({ error: 'Game is no longer active.' }, { status: 410 });
    }

    const flags = matchedModeFlags(row.status);
    const snap = await getMatchState(roomId);
    const stateMode = snap?.mode;
    const limited = flags.limited || stateMode === 'limited' || stateMode === 'limited_draft';
    const tft = flags.tft || stateMode === 'tft';
    const farmers = flags.farmers || stateMode === 'farmers';

    let opponentAlive = false;
    let opponentName = row.opponent_name || '';

    if (tft) {
      const peers = await listTftLobbyMembers(roomId);
      const others = peers.filter((p) => p.sessionToken !== sessionToken);
      opponentAlive = others.length > 0;
      opponentName = others.map((p) => p.playerName).join(', ') || opponentName;
      if (!opponentAlive && !snap) {
        return NextResponse.json(
          { error: 'Other players left or the match timed out.' },
          { status: 410 },
        );
      }
      for (const p of peers) await touchQueueSession(p.sessionToken);
    } else {
      const opponent = row.opponent_token ? await findQueueRowByToken(row.opponent_token) : null;
      opponentAlive = opponent ? await isQueueSessionAlive(opponent) : false;
      if (!opponent || (!opponentAlive && !snap)) {
        return NextResponse.json(
          { error: 'Opponent left or the match timed out.' },
          { status: 410 },
        );
      }
      await touchQueueSession(sessionToken);
      if (opponent.session_token) await touchQueueSession(opponent.session_token);
    }

    const startsAt = Date.now() + 1200;
    const joinTicket =
      !tft && !farmers && (row.player_slot === 0 || row.player_slot === 1)
        ? mintTdgJoinTicket({
            roomId: row.room_id,
            sessionToken: row.session_token,
            playerSlot: row.player_slot,
            playerName: row.player_name,
            opponentName: opponentName || undefined,
            startsAt,
          })
        : null;

    let roster: Array<{ slot: number; name: string }> | undefined;
    let isHost = row.player_slot === 0;
    if (tft) {
      const peers = (await sql`
        SELECT player_slot, player_name
        FROM tdg_pvp_queue
        WHERE room_id = ${roomId}
          AND status = 'matched_tft'
        ORDER BY player_slot ASC
      `) as unknown as Array<{ player_slot: number; player_name: string }>;
      roster = peers.map((p) => ({ slot: Number(p.player_slot), name: p.player_name }));
      if (roster.length) {
        const hostSlot = Math.min(...roster.map((p) => p.slot));
        isHost = row.player_slot === hostSlot;
      }
    }

    return NextResponse.json({
      status: 'matched',
      resume: true,
      sessionToken: row.session_token,
      roomId: row.room_id,
      playerId: row.player_slot,
      opponentName,
      isHost,
      playerName: row.player_name,
      startsAt,
      joinTicket,
      serverAuth: Boolean(joinTicket),
      limited,
      tft,
      farmers,
      roster,
      state: snap?.state ?? null,
      stateUpdatedAt: snap?.updated_at ?? null,
    });
  } catch (error) {
    console.error('tdg-pvp rejoin error:', error);
    return NextResponse.json({ error: 'Could not rejoin game.' }, { status: 500 });
  }
}
