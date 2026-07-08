import { NextRequest, NextResponse } from 'next/server';
import { safeTrigger } from '@/lib/pusher';
import { ensureTdgPvpTables, removeQueueSession, verifyRoomPlayer } from '@/lib/tdg-pvp';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { roomId?: string; sessionToken?: string };
    const roomId = typeof body.roomId === 'string' ? body.roomId.trim() : '';
    const sessionToken =
      typeof body.sessionToken === 'string' ? body.sessionToken.trim().slice(0, 64) : '';

    if (!roomId || !sessionToken) {
      return NextResponse.json({ error: 'Invalid forfeit payload.' }, { status: 400 });
    }

    await ensureTdgPvpTables();
    const player = await verifyRoomPlayer(roomId, sessionToken);
    if (!player) {
      return NextResponse.json({ error: 'Not in this match.' }, { status: 403 });
    }

    await safeTrigger(`tdg-room-${roomId}`, 'forfeit', {
      from: player.player_slot,
      name: player.player_name,
      t: Date.now(),
    });

    await removeQueueSession(sessionToken);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('tdg-pvp forfeit error:', error);
    return NextResponse.json({ error: 'Forfeit failed.' }, { status: 500 });
  }
}
