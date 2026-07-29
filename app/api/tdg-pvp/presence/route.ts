import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { resolveClientGeo } from '@/lib/client-geo';
import {
  ensureTdgPresenceTable,
  listLiveTdgPresence,
  removeTdgPresence,
  upsertTdgPresence,
} from '@/lib/tdg-presence';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Live visitors currently on /TDG (heartbeat-based). */
export async function GET() {
  try {
    await ensureTdgPresenceTable();
    const online = await listLiveTdgPresence();
    return NextResponse.json({
      ok: true,
      count: online.length,
      online,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('tdg presence GET error:', error);
    return NextResponse.json({ error: 'Could not load presence.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      visitorId?: string;
      displayName?: string;
      screen?: string;
      leave?: boolean;
    };

    const visitorId = typeof body.visitorId === 'string' ? body.visitorId.trim().slice(0, 64) : '';
    if (!visitorId || visitorId.length < 8) {
      return NextResponse.json({ error: 'Missing visitor id.' }, { status: 400 });
    }

    await ensureTdgPresenceTable();

    if (body.leave) {
      await removeTdgPresence(visitorId);
      return NextResponse.json({ ok: true, left: true });
    }

    let userId: string | null = null;
    let sessionName: string | null = null;
    try {
      const session = await auth();
      if (session?.user?.id) userId = session.user.id;
      if (session?.user?.displayName) sessionName = session.user.displayName;
      else if (session?.user?.name) sessionName = session.user.name;
    } catch {
      // Auth optional for guests.
    }

    const displayName =
      (typeof body.displayName === 'string' && body.displayName.trim()) ||
      sessionName ||
      null;

    const geo = await resolveClientGeo(request);

    const row = await upsertTdgPresence({
      visitorId,
      displayName,
      userId,
      screen: typeof body.screen === 'string' ? body.screen : 'menu',
      ipAddress: geo.ip,
      city: geo.city,
      region: geo.region,
      country: geo.country,
      locationLabel: geo.locationLabel,
    });

    return NextResponse.json({
      ok: true,
      visitorId: row?.visitor_id,
      displayName: row?.display_name,
      screen: row?.screen,
      ipAddress: row?.ip_address,
      location: row?.location_label,
    });
  } catch (error) {
    console.error('tdg presence POST error:', error);
    return NextResponse.json({ error: 'Presence update failed.' }, { status: 500 });
  }
}
