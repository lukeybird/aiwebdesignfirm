import { NextRequest, NextResponse } from 'next/server';
import {
  ensureTdgPvpTables,
  findQueueRowByToken,
  notifyOpponentSessionEnded,
  removeQueueSession,
} from '@/lib/tdg-pvp';
import { recordDisconnect } from '@/lib/tdg-pvp-activity';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { sessionToken?: string };
    const sessionToken =
      typeof body.sessionToken === 'string' ? body.sessionToken.trim().slice(0, 64) : '';

    if (!sessionToken) {
      return NextResponse.json({ error: 'Missing session.' }, { status: 400 });
    }

    await ensureTdgPvpTables();

    const row = await findQueueRowByToken(sessionToken);
    if (row?.room_id && (row.status === 'matched' || row.status === 'matched_limited') && row.player_slot !== null) {
      await recordDisconnect(row.room_id, row.player_slot);
    }

    const removed = await removeQueueSession(sessionToken);
    if (removed?.room_id) {
      await notifyOpponentSessionEnded(removed, 'match_cancelled', {
        reason: 'opponent_left',
        t: Date.now(),
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('tdg-pvp leave error:', error);
    return NextResponse.json({ error: 'Could not leave queue.' }, { status: 500 });
  }
}
