import { NextRequest, NextResponse } from 'next/server';
import { ensureTdgPvpTables, touchQueueSession, verifyRoomPlayer, currentServerTick, TDG_INPUT_DELAY_TICKS } from '@/lib/tdg-pvp';
import { sql } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      roomId?: string;
      sessionToken?: string;
      action?: Record<string, unknown>;
    };

    const roomId = typeof body.roomId === 'string' ? body.roomId.trim() : '';
    const sessionToken =
      typeof body.sessionToken === 'string' ? body.sessionToken.trim().slice(0, 64) : '';
    const action = body.action;

    if (!roomId || !sessionToken || !action || typeof action !== 'object') {
      return NextResponse.json({ error: 'Invalid action payload.' }, { status: 400 });
    }

    await ensureTdgPvpTables();
    const player = await verifyRoomPlayer(roomId, sessionToken);
    if (!player) {
      return NextResponse.json({ error: 'Not in this match.' }, { status: 403 });
    }

    await touchQueueSession(sessionToken);
    const nowTick = await currentServerTick(roomId);
    const tick = nowTick + TDG_INPUT_DELAY_TICKS;
    await sql`
      INSERT INTO tdg_pvp_actions (room_id, tick, from_player, action)
      VALUES (${roomId}, ${tick}, ${player.player_slot}, ${JSON.stringify(action)}::jsonb)
    `;

    return NextResponse.json({ ok: true, tick, nowTick });
  } catch (error) {
    console.error('tdg-pvp action error:', error);
    return NextResponse.json({ error: 'Action failed.' }, { status: 500 });
  }
}
