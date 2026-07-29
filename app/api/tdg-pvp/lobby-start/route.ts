import { NextRequest, NextResponse } from 'next/server';
import { ensureTdgPvpTables, cleanupStaleTdgQueue } from '@/lib/tdg-pvp';
import { startTftLobby } from '@/lib/tdg-tft-lobby';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Host starts a TFT lobby early (2–3 players), or anyone when full (handled in join). */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { sessionToken?: string; roomId?: string };
    const sessionToken = typeof body.sessionToken === 'string' ? body.sessionToken.trim().slice(0, 64) : '';
    const roomId = typeof body.roomId === 'string' ? body.roomId.trim().slice(0, 64) : '';
    if (!sessionToken || !roomId) {
      return NextResponse.json({ error: 'Missing lobby session.' }, { status: 400 });
    }

    await ensureTdgPvpTables();
    await cleanupStaleTdgQueue();

    const result = await startTftLobby(roomId, sessionToken);
    return NextResponse.json(result);
  } catch (error) {
    const status = typeof (error as { status?: number })?.status === 'number'
      ? (error as { status: number }).status
      : 500;
    const message = error instanceof Error ? error.message : 'Could not start lobby.';
    if (status !== 500) return NextResponse.json({ error: message }, { status });
    console.error('tdg-pvp lobby-start error:', error);
    return NextResponse.json({ error: 'Could not start lobby.' }, { status: 500 });
  }
}
