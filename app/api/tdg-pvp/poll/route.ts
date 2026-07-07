import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { currentServerTick, ensureTdgPvpTables, touchQueueSession, verifyRoomPlayer } from '@/lib/tdg-pvp';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      roomId?: string;
      sessionToken?: string;
      lastTick?: number;
    };
    const roomId = typeof body.roomId === 'string' ? body.roomId.trim() : '';
    const sessionToken =
      typeof body.sessionToken === 'string' ? body.sessionToken.trim().slice(0, 64) : '';
    const lastTick = Number.isFinite(body.lastTick) ? Math.max(-1, Math.floor(body.lastTick as number)) : -1;

    if (!roomId || !sessionToken) {
      return NextResponse.json({ error: 'Invalid poll payload.' }, { status: 400 });
    }

    await ensureTdgPvpTables();
    const player = await verifyRoomPlayer(roomId, sessionToken);
    if (!player) {
      return NextResponse.json({ error: 'Not in this match.' }, { status: 403 });
    }
    await touchQueueSession(sessionToken);

    const nowTick = await currentServerTick(roomId);
    const rows = (await sql`
      SELECT tick, from_player, action
      FROM tdg_pvp_actions
      WHERE room_id = ${roomId}
        AND tick > ${lastTick}
        AND tick <= ${nowTick}
      ORDER BY tick ASC, id ASC
      LIMIT 800
    `) as unknown as Array<{ tick: number; from_player: number; action: Record<string, unknown> }>;

    return NextResponse.json({
      ok: true,
      nowTick,
      actions: rows.map((r) => ({ tick: r.tick, from: r.from_player, action: r.action })),
    });
  } catch (error) {
    console.error('tdg-pvp poll error:', error);
    return NextResponse.json({ error: 'Poll failed.' }, { status: 500 });
  }
}

