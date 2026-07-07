import { NextRequest, NextResponse } from 'next/server';
import {
  cleanupStaleTdgQueue,
  ensureTdgPvpTables,
  findQueueRowByToken,
  touchQueueSession,
} from '@/lib/tdg-pvp';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { sessionToken?: string };
    const sessionToken =
      typeof body.sessionToken === 'string' ? body.sessionToken.trim().slice(0, 64) : '';

    if (!sessionToken) {
      return NextResponse.json({ error: 'Missing session.' }, { status: 400 });
    }

    await ensureTdgPvpTables();
    await cleanupStaleTdgQueue();

    const row = await findQueueRowByToken(sessionToken);
    if (!row) {
      return NextResponse.json({ status: 'gone' });
    }

    await touchQueueSession(sessionToken);

    return NextResponse.json({
      ok: true,
      status: row.status,
      roomId: row.room_id,
    });
  } catch (error) {
    console.error('tdg-pvp ping error:', error);
    return NextResponse.json({ error: 'Ping failed.' }, { status: 500 });
  }
}
