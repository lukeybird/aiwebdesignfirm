import { NextRequest, NextResponse } from 'next/server';
import { safeTrigger } from '@/lib/pusher';
import { ensureTdgPvpTables, touchQueueSession, verifyRoomPlayer } from '@/lib/tdg-pvp';

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

    // A Pusher outage/quota rejection must not fail the request: the game is
    // lockstep and resends frame-sync heartbeats, so a dropped broadcast is
    // recoverable and should not surface as a 500.
    const delivered = await safeTrigger(`tdg-room-${roomId}`, 'action', {
      action,
      from: player.player_slot,
      t: Date.now(),
    });

    return NextResponse.json({ ok: true, delivered });
  } catch (error) {
    console.error('tdg-pvp action error:', error);
    return NextResponse.json({ error: 'Action failed.' }, { status: 500 });
  }
}
