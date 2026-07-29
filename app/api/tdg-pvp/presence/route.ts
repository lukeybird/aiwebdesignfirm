import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { parseGpsBody, resolveClientGeo, reverseGeocodeCoords } from '@/lib/client-geo';
import {
  isDeveloperAuthenticatedRequest,
  unauthorizedDeveloperJson,
} from '@/lib/developer-auth';
import {
  ensureTdgPresenceTable,
  listLiveTdgPresence,
  removeTdgPresence,
  upsertTdgPresence,
} from '@/lib/tdg-presence';
import { appendPresenceLog } from '@/lib/tdg-presence-log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Live visitors currently on the site (heartbeat-based). Developer-only. */
export async function GET(request: NextRequest) {
  try {
    if (!isDeveloperAuthenticatedRequest(request)) {
      return unauthorizedDeveloperJson();
    }
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
      lat?: number;
      lng?: number;
      accuracy?: number;
    };

    const visitorId = typeof body.visitorId === 'string' ? body.visitorId.trim().slice(0, 64) : '';
    if (!visitorId || visitorId.length < 8) {
      return NextResponse.json({ error: 'Missing visitor id.' }, { status: 400 });
    }

    await ensureTdgPresenceTable();

    if (body.leave) {
      const existing = await listLiveTdgPresence().catch(() => []);
      // Live list only has active people; fall back to a bare leave event.
      const me = existing.find((v) => v.visitorId === visitorId);
      await appendPresenceLog({
        visitorId,
        displayName: me?.displayName || null,
        screen: me?.screen || (typeof body.screen === 'string' ? body.screen : 'leave'),
        ipAddress: me?.ipAddress || null,
        city: me?.city || null,
        region: me?.region || null,
        country: me?.country || null,
        locationLabel: me?.location || null,
        latitude: me?.latitude ?? null,
        longitude: me?.longitude ?? null,
        accuracyM: me?.accuracyM ?? null,
        preciseLabel: me?.preciseLocation || null,
        geoSource: me?.geoSource || null,
        eventType: 'leave',
      });
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
    const gps = parseGpsBody(body);

    let city = geo.city;
    let region = geo.region;
    let country = geo.country;
    let locationLabel = geo.locationLabel;
    let latitude: number | null = null;
    let longitude: number | null = null;
    let accuracyM: number | null = null;
    let preciseLabel: string | null = null;
    let geoSource: 'gps' | 'ip' = 'ip';

    if (gps) {
      latitude = gps.lat;
      longitude = gps.lng;
      accuracyM = gps.accuracy;
      geoSource = 'gps';
      const precise = await reverseGeocodeCoords(gps.lat, gps.lng);
      if (precise) {
        city = precise.city || city;
        region = precise.region || region;
        country = precise.country || country;
        preciseLabel = precise.preciseLabel;
        locationLabel = precise.preciseLabel || locationLabel;
      } else {
        preciseLabel = `${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)}`;
        locationLabel = preciseLabel;
      }
    } else if (geo.latitude != null && geo.longitude != null) {
      latitude = geo.latitude;
      longitude = geo.longitude;
      accuracyM = 25000;
      geoSource = 'ip';
    }

    const screen = typeof body.screen === 'string' ? body.screen : 'menu';

    const row = await upsertTdgPresence({
      visitorId,
      displayName,
      userId,
      screen,
      ipAddress: geo.ip,
      city,
      region,
      country,
      locationLabel,
      latitude,
      longitude,
      accuracyM,
      preciseLabel,
      geoSource,
    });

    await appendPresenceLog({
      visitorId,
      displayName: row?.display_name || displayName,
      userId,
      screen: row?.screen || screen,
      ipAddress: row?.ip_address || geo.ip,
      city: row?.city || city,
      region: row?.region || region,
      country: row?.country || country,
      locationLabel: row?.location_label || locationLabel,
      latitude: row?.latitude != null ? Number(row.latitude) : latitude,
      longitude: row?.longitude != null ? Number(row.longitude) : longitude,
      accuracyM: row?.accuracy_m != null ? Number(row.accuracy_m) : accuracyM,
      preciseLabel: row?.precise_label || preciseLabel,
      geoSource: (row?.geo_source as 'gps' | 'ip' | null) || geoSource,
      eventType: 'ping',
    });

    return NextResponse.json({
      ok: true,
      visitorId: row?.visitor_id,
      displayName: row?.display_name,
      screen: row?.screen,
      ipAddress: row?.ip_address,
      location: row?.precise_label || row?.location_label,
      latitude: row?.latitude,
      longitude: row?.longitude,
      geoSource: row?.geo_source,
    });
  } catch (error) {
    console.error('tdg presence POST error:', error);
    return NextResponse.json({ error: 'Presence update failed.' }, { status: 500 });
  }
}
