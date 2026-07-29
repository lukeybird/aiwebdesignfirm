import { NextRequest, NextResponse } from 'next/server';
import {
  ensurePresenceLogTable,
  getPresenceHistorySummary,
  listPresenceHistory,
} from '@/lib/tdg-presence-log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Historical visitor location log for /activity recall. */
export async function GET(request: NextRequest) {
  try {
    await ensurePresenceLogTable();
    const hours = Number(request.nextUrl.searchParams.get('hours') || 168);
    const limit = Number(request.nextUrl.searchParams.get('limit') || 250);
    const visitorId = request.nextUrl.searchParams.get('visitorId');
    const q = request.nextUrl.searchParams.get('q');

    const [history, summary] = await Promise.all([
      listPresenceHistory({ hours, limit, visitorId, q }),
      getPresenceHistorySummary(Number.isFinite(hours) ? hours : 168),
    ]);

    return NextResponse.json({
      ok: true,
      history,
      summary: {
        events: Number(summary.events) || 0,
        visitors: Number(summary.visitors) || 0,
        gpsEvents: Number(summary.gps_events) || 0,
        mappedEvents: Number(summary.mapped_events) || 0,
        hours: Number.isFinite(hours) ? hours : 168,
      },
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('tdg presence-log GET error:', error);
    return NextResponse.json({ error: 'Could not load presence history.' }, { status: 500 });
  }
}
