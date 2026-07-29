import { initDatabase, sql } from '@/lib/db';

export type PresenceLogInsert = {
  visitorId: string;
  displayName?: string | null;
  userId?: string | null;
  screen?: string | null;
  ipAddress?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  locationLabel?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  accuracyM?: number | null;
  preciseLabel?: string | null;
  geoSource?: string | null;
  eventType?: 'ping' | 'leave' | 'seen';
};

export type PresenceLogPublic = {
  id: number;
  visitorId: string;
  displayName: string;
  signedIn: boolean;
  screen: string;
  ipAddress: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracyM: number | null;
  preciseLocation: string | null;
  geoSource: 'gps' | 'ip' | null;
  mapsUrl: string | null;
  eventType: string;
  recordedAt: string;
};

let ensured = false;

export async function ensurePresenceLogTable() {
  await initDatabase();
  if (ensured) return;
  await sql`
    CREATE TABLE IF NOT EXISTS tdg_presence_log (
      id BIGSERIAL PRIMARY KEY,
      visitor_id VARCHAR(64) NOT NULL,
      display_name VARCHAR(50),
      user_id UUID,
      screen VARCHAR(40),
      ip_address VARCHAR(64),
      city VARCHAR(80),
      region VARCHAR(80),
      country VARCHAR(80),
      location_label VARCHAR(200),
      latitude DOUBLE PRECISION,
      longitude DOUBLE PRECISION,
      accuracy_m REAL,
      precise_label VARCHAR(200),
      geo_source VARCHAR(12),
      event_type VARCHAR(20) NOT NULL DEFAULT 'ping',
      recorded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_tdg_presence_log_time
    ON tdg_presence_log (recorded_at DESC)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_tdg_presence_log_visitor
    ON tdg_presence_log (visitor_id, recorded_at DESC)
  `;
  ensured = true;
}

function mapsUrl(lat: number | null, lng: number | null) {
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

function haversineM(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Decide whether this heartbeat deserves a durable history row. */
async function shouldLogPresence(params: PresenceLogInsert): Promise<boolean> {
  if (params.eventType === 'leave') return true;

  const recent = (await sql`
    SELECT screen, ip_address, latitude, longitude, geo_source, recorded_at
    FROM tdg_presence_log
    WHERE visitor_id = ${params.visitorId}
    ORDER BY recorded_at DESC
    LIMIT 1
  `) as unknown as Array<{
    screen: string | null;
    ip_address: string | null;
    latitude: number | null;
    longitude: number | null;
    geo_source: string | null;
    recorded_at: string | Date;
  }>;

  const last = recent[0];
  if (!last) return true;

  const ageMs = Date.now() - new Date(last.recorded_at).getTime();
  if (ageMs >= 2 * 60 * 1000) return true; // at least every 2 minutes while active

  if ((params.screen || '') !== (last.screen || '')) return true;
  if ((params.ipAddress || '') !== (last.ip_address || '')) return true;
  if (params.geoSource === 'gps' && last.geo_source !== 'gps') return true;

  const lat = params.latitude;
  const lng = params.longitude;
  const prevLat = last.latitude != null ? Number(last.latitude) : null;
  const prevLng = last.longitude != null ? Number(last.longitude) : null;
  if (lat != null && lng != null) {
    if (prevLat == null || prevLng == null) return true;
    if (haversineM(prevLat, prevLng, lat, lng) >= 40) return true; // moved ~40m+
  }

  return false;
}

export async function appendPresenceLog(params: PresenceLogInsert) {
  await ensurePresenceLogTable();
  const visitorId = params.visitorId.trim().slice(0, 64);
  if (!visitorId) return null;

  const eventType = params.eventType || 'ping';
  const should = await shouldLogPresence({ ...params, eventType });
  if (!should) return null;

  const displayName = (params.displayName || '').trim().slice(0, 50) || null;
  const userId = params.userId || null;
  const screen = (params.screen || '').trim().slice(0, 40) || null;
  const ipAddress = (params.ipAddress || '').trim().slice(0, 64) || null;
  const city = (params.city || '').trim().slice(0, 80) || null;
  const region = (params.region || '').trim().slice(0, 80) || null;
  const country = (params.country || '').trim().slice(0, 80) || null;
  const locationLabel = (params.locationLabel || '').trim().slice(0, 200) || null;
  const latitude = Number.isFinite(params.latitude as number) ? Number(params.latitude) : null;
  const longitude = Number.isFinite(params.longitude as number) ? Number(params.longitude) : null;
  const accuracyM = Number.isFinite(params.accuracyM as number) ? Number(params.accuracyM) : null;
  const preciseLabel = (params.preciseLabel || '').trim().slice(0, 200) || null;
  const geoSource = params.geoSource === 'gps' || params.geoSource === 'ip' ? params.geoSource : null;

  const rows = (await sql`
    INSERT INTO tdg_presence_log (
      visitor_id, display_name, user_id, screen,
      ip_address, city, region, country, location_label,
      latitude, longitude, accuracy_m, precise_label, geo_source,
      event_type, recorded_at
    ) VALUES (
      ${visitorId}, ${displayName}, ${userId}, ${screen},
      ${ipAddress}, ${city}, ${region}, ${country}, ${locationLabel},
      ${latitude}, ${longitude}, ${accuracyM}, ${preciseLabel}, ${geoSource},
      ${eventType}, CURRENT_TIMESTAMP
    )
    RETURNING id
  `) as unknown as Array<{ id: number }>;

  return rows[0]?.id ?? null;
}

function mapLogRow(row: {
  id: number;
  visitor_id: string;
  display_name: string | null;
  user_id: string | null;
  screen: string | null;
  ip_address: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  location_label: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracy_m: number | null;
  precise_label: string | null;
  geo_source: string | null;
  event_type: string;
  recorded_at: string | Date;
}): PresenceLogPublic {
  const lat = row.latitude != null ? Number(row.latitude) : null;
  const lng = row.longitude != null ? Number(row.longitude) : null;
  const geoSource = row.geo_source === 'gps' || row.geo_source === 'ip' ? row.geo_source : null;
  return {
    id: Number(row.id),
    visitorId: row.visitor_id,
    displayName: row.display_name || `Guest ${row.visitor_id.slice(0, 4)}`,
    signedIn: !!row.user_id,
    screen: row.screen || 'site',
    ipAddress: row.ip_address || null,
    city: row.city || null,
    region: row.region || null,
    country: row.country || null,
    location: row.precise_label
      || row.location_label
      || [row.city, row.region, row.country].filter(Boolean).join(', ')
      || null,
    latitude: Number.isFinite(lat as number) ? lat : null,
    longitude: Number.isFinite(lng as number) ? lng : null,
    accuracyM: row.accuracy_m != null ? Number(row.accuracy_m) : null,
    preciseLocation: row.precise_label || null,
    geoSource,
    mapsUrl: mapsUrl(lat, lng),
    eventType: row.event_type || 'ping',
    recordedAt: new Date(row.recorded_at).toISOString(),
  };
}

export async function listPresenceHistory(opts: {
  hours?: number;
  limit?: number;
  visitorId?: string | null;
  q?: string | null;
} = {}): Promise<PresenceLogPublic[]> {
  await ensurePresenceLogTable();
  const hours = Math.min(Math.max(opts.hours ?? 168, 1), 24 * 365); // 1h .. 1y
  const limit = Math.min(Math.max(opts.limit ?? 200, 1), 1000);
  const visitorId = opts.visitorId?.trim().slice(0, 64) || null;
  const q = opts.q?.trim().slice(0, 64) || null;
  const like = q ? `%${q}%` : null;

  const rows = (await sql`
    SELECT
      id, visitor_id, display_name, user_id, screen,
      ip_address, city, region, country, location_label,
      latitude, longitude, accuracy_m, precise_label, geo_source,
      event_type, recorded_at
    FROM tdg_presence_log
    WHERE recorded_at >= NOW() - (${hours} * INTERVAL '1 hour')
      AND (${visitorId}::text IS NULL OR visitor_id = ${visitorId})
      AND (
        ${like}::text IS NULL
        OR display_name ILIKE ${like}
        OR ip_address ILIKE ${like}
        OR precise_label ILIKE ${like}
        OR location_label ILIKE ${like}
        OR city ILIKE ${like}
        OR visitor_id ILIKE ${like}
      )
    ORDER BY recorded_at DESC
    LIMIT ${limit}
  `) as unknown as Array<Parameters<typeof mapLogRow>[0]>;

  return rows.map(mapLogRow);
}

export async function getPresenceHistorySummary(hours = 168) {
  await ensurePresenceLogTable();
  const h = Math.min(Math.max(hours, 1), 24 * 365);
  const rows = (await sql`
    SELECT
      COUNT(*)::int AS events,
      COUNT(DISTINCT visitor_id)::int AS visitors,
      COUNT(*) FILTER (WHERE geo_source = 'gps')::int AS gps_events,
      COUNT(*) FILTER (WHERE latitude IS NOT NULL)::int AS mapped_events
    FROM tdg_presence_log
    WHERE recorded_at >= NOW() - (${h} * INTERVAL '1 hour')
  `) as unknown as Array<{
    events: number;
    visitors: number;
    gps_events: number;
    mapped_events: number;
  }>;
  return rows[0] || { events: 0, visitors: 0, gps_events: 0, mapped_events: 0 };
}
