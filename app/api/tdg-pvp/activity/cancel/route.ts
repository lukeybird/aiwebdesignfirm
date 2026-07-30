import { NextRequest, NextResponse } from 'next/server';
import { cancelActiveMatch, ensureTdgPvpTables } from '@/lib/tdg-pvp';
import {
  isDeveloperAuthenticatedRequest,
  unauthorizedDeveloperJson,
} from '@/lib/developer-auth';

/** Developer-only: force-cancel an active TDG match from /activity. */
export async function POST(request: NextRequest) {
  try {
    if (!isDeveloperAuthenticatedRequest(request)) {
      return unauthorizedDeveloperJson();
    }

    const body = (await request.json()) as { roomId?: string };
    const roomId = typeof body.roomId === 'string' ? body.roomId.trim().slice(0, 64) : '';
    if (!roomId) {
      return NextResponse.json({ error: 'Missing room id.' }, { status: 400 });
    }

    await ensureTdgPvpTables();
    const result = await cancelActiveMatch(roomId, {
      reason: 'admin_cancel',
      notifyReason: 'admin_cancel',
    });

    if (!result.ok) {
      return NextResponse.json({ error: 'Match not found or already ended.' }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      cancelled: result.cancelled,
      notified: result.notified,
    });
  } catch (error) {
    console.error('tdg-pvp activity cancel error:', error);
    return NextResponse.json({ error: 'Could not cancel match.' }, { status: 500 });
  }
}
