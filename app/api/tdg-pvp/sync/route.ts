import { NextRequest, NextResponse } from 'next/server';
import { safeTrigger } from '@/lib/pusher';
import {
  ensureTdgPvpTables,
  touchQueueSession,
  upsertMatchState,
  verifyRoomPlayer,
} from '@/lib/tdg-pvp';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      roomId?: string;
      sessionToken?: string;
      state?: unknown;
    };

    const roomId = typeof body.roomId === 'string' ? body.roomId.trim() : '';
    const sessionToken =
      typeof body.sessionToken === 'string' ? body.sessionToken.trim().slice(0, 64) : '';

    if (!roomId || !sessionToken || body.state === undefined) {
      return NextResponse.json({ error: 'Invalid sync payload.' }, { status: 400 });
    }

    await ensureTdgPvpTables();
    const player = await verifyRoomPlayer(roomId, sessionToken);
    if (!player || player.player_slot !== 0) {
      return NextResponse.json({ error: 'Only the host can sync state.' }, { status: 403 });
    }

    await touchQueueSession(sessionToken);
    // Persist for refresh / ?game= rejoin, then fan out live.
    try {
      await upsertMatchState(roomId, body.state, player.player_slot);
    } catch (err) {
      console.warn('tdg-pvp match state upsert failed', err);
    }

    await safeTrigger(`tdg-room-${roomId}`, 'state', {
      state: body.state,
      from: player.player_slot,
      t: Date.now(),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('tdg-pvp sync error:', error);
    return NextResponse.json({ error: 'Sync failed.' }, { status: 500 });
  }
}
