import { initDatabase, sql } from '@/lib/db';

export const TDG_PRESENCE_ALIVE_SECONDS = 45;

export type TdgPresenceRow = {
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
  last_seen_at: string | Date;
  first_seen_at: string | Date;
};

export type TdgPresencePublic = {
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
  lastSeenAt: string;
  firstSeenAt: string;
};

let ensured = false;

export async function ensureTdgPresenceTable() {
  await initDatabase();
  if (ensured) return;
  await sql`
    CREATE TABLE IF NOT EXISTS tdg_presence (
      visitor_id VARCHAR(64) PRIMARY KEY,
      display_name VARCHAR(50),
      user_id UUID,
      screen VARCHAR(40) DEFAULT 'menu',
      ip_address VARCHAR(64),
      city VARCHAR(80),
      region VARCHAR(80),
      country VARCHAR(80),
      location_label VARCHAR(120),
      latitude DOUBLE PRECISION,
      longitude DOUBLE PRECISION,
      accuracy_m REAL,
      precise_label VARCHAR(200),
      geo_source VARCHAR(12),
      last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      first_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await sql`ALTER TABLE tdg_presence ADD COLUMN IF NOT EXISTS ip_address VARCHAR(64)`;
  await sql`ALTER TABLE tdg_presence ADD COLUMN IF NOT EXISTS city VARCHAR(80)`;
  await sql`ALTER TABLE tdg_presence ADD COLUMN IF NOT EXISTS region VARCHAR(80)`;
  await sql`ALTER TABLE tdg_presence ADD COLUMN IF NOT EXISTS country VARCHAR(80)`;
  await sql`ALTER TABLE tdg_presence ADD COLUMN IF NOT EXISTS location_label VARCHAR(120)`;
  await sql`ALTER TABLE tdg_presence ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION`;
  await sql`ALTER TABLE tdg_presence ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION`;
  await sql`ALTER TABLE tdg_presence ADD COLUMN IF NOT EXISTS accuracy_m REAL`;
  await sql`ALTER TABLE tdg_presence ADD COLUMN IF NOT EXISTS precise_label VARCHAR(200)`;
  await sql`ALTER TABLE tdg_presence ADD COLUMN IF NOT EXISTS geo_source VARCHAR(12)`;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_tdg_presence_alive
    ON tdg_presence (last_seen_at DESC)
  `;
  ensured = true;
}

export async function cleanupStaleTdgPresence() {
  await sql`
    DELETE FROM tdg_presence
    WHERE last_seen_at < NOW() - INTERVAL '2 minutes'
  `;
}

export async function upsertTdgPresence(params: {
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
  geoSource?: 'gps' | 'ip' | null;
}) {
  const visitorId = params.visitorId.trim().slice(0, 64);
  if (!visitorId) return null;

  const displayName = (params.displayName || '').trim().slice(0, 50) || null;
  const userId = params.userId || null;
  const screen = (params.screen || 'menu').trim().slice(0, 40) || 'menu';
  const ipAddress = (params.ipAddress || '').trim().slice(0, 64) || null;
  const city = (params.city || '').trim().slice(0, 80) || null;
  const region = (params.region || '').trim().slice(0, 80) || null;
  const country = (params.country || '').trim().slice(0, 80) || null;
  const locationLabel = (params.locationLabel || '').trim().slice(0, 120) || null;
  const latitude = Number.isFinite(params.latitude as number) ? Number(params.latitude) : null;
  const longitude = Number.isFinite(params.longitude as number) ? Number(params.longitude) : null;
  const accuracyM = Number.isFinite(params.accuracyM as number) ? Number(params.accuracyM) : null;
  const preciseLabel = (params.preciseLabel || '').trim().slice(0, 200) || null;
  const geoSource = params.geoSource === 'gps' || params.geoSource === 'ip' ? params.geoSource : null;

  const rows = (await sql`
    INSERT INTO tdg_presence (
      visitor_id, display_name, user_id, screen,
      ip_address, city, region, country, location_label,
      latitude, longitude, accuracy_m, precise_label, geo_source,
      last_seen_at, first_seen_at
    )
    VALUES (
      ${visitorId}, ${displayName}, ${userId}, ${screen},
      ${ipAddress}, ${city}, ${region}, ${country}, ${locationLabel},
      ${latitude}, ${longitude}, ${accuracyM}, ${preciseLabel}, ${geoSource},
      CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
    ON CONFLICT (visitor_id) DO UPDATE SET
      display_name = COALESCE(EXCLUDED.display_name, tdg_presence.display_name),
      user_id = COALESCE(EXCLUDED.user_id, tdg_presence.user_id),
      screen = EXCLUDED.screen,
      ip_address = COALESCE(EXCLUDED.ip_address, tdg_presence.ip_address),
      city = COALESCE(EXCLUDED.city, tdg_presence.city),
      region = COALESCE(EXCLUDED.region, tdg_presence.region),
      country = COALESCE(EXCLUDED.country, tdg_presence.country),
      location_label = COALESCE(EXCLUDED.location_label, tdg_presence.location_label),
      latitude = CASE
        WHEN EXCLUDED.geo_source = 'gps' THEN EXCLUDED.latitude
        WHEN tdg_presence.geo_source = 'gps' THEN tdg_presence.latitude
        ELSE COALESCE(EXCLUDED.latitude, tdg_presence.latitude)
      END,
      longitude = CASE
        WHEN EXCLUDED.geo_source = 'gps' THEN EXCLUDED.longitude
        WHEN tdg_presence.geo_source = 'gps' THEN tdg_presence.longitude
        ELSE COALESCE(EXCLUDED.longitude, tdg_presence.longitude)
      END,
      accuracy_m = CASE
        WHEN EXCLUDED.geo_source = 'gps' THEN EXCLUDED.accuracy_m
        WHEN tdg_presence.geo_source = 'gps' THEN tdg_presence.accuracy_m
        ELSE COALESCE(EXCLUDED.accuracy_m, tdg_presence.accuracy_m)
      END,
      precise_label = CASE
        WHEN EXCLUDED.geo_source = 'gps' THEN COALESCE(EXCLUDED.precise_label, tdg_presence.precise_label)
        WHEN tdg_presence.geo_source = 'gps' THEN tdg_presence.precise_label
        ELSE COALESCE(EXCLUDED.precise_label, tdg_presence.precise_label)
      END,
      geo_source = CASE
        WHEN EXCLUDED.geo_source = 'gps' OR tdg_presence.geo_source = 'gps' THEN 'gps'
        ELSE COALESCE(EXCLUDED.geo_source, tdg_presence.geo_source)
      END,
      last_seen_at = CURRENT_TIMESTAMP
    RETURNING
      visitor_id, display_name, user_id, screen,
      ip_address, city, region, country, location_label,
      latitude, longitude, accuracy_m, precise_label, geo_source,
      last_seen_at, first_seen_at
  `) as unknown as TdgPresenceRow[];

  return rows[0] ?? null;
}

export async function removeTdgPresence(visitorId: string) {
  const id = visitorId.trim().slice(0, 64);
  if (!id) return;
  await sql`DELETE FROM tdg_presence WHERE visitor_id = ${id}`;
}

function guestLabel(visitorId: string) {
  return `Guest ${visitorId.slice(0, 4)}`;
}

function mapsUrl(lat: number | null, lng: number | null) {
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

export async function listLiveTdgPresence(): Promise<TdgPresencePublic[]> {
  await cleanupStaleTdgPresence();
  const rows = (await sql`
    SELECT
      visitor_id, display_name, user_id, screen,
      ip_address, city, region, country, location_label,
      latitude, longitude, accuracy_m, precise_label, geo_source,
      last_seen_at, first_seen_at
    FROM tdg_presence
    WHERE last_seen_at >= NOW() - INTERVAL '45 seconds'
    ORDER BY last_seen_at DESC
  `) as unknown as TdgPresenceRow[];

  return rows.map((row) => {
    const lat = row.latitude != null ? Number(row.latitude) : null;
    const lng = row.longitude != null ? Number(row.longitude) : null;
    const geoSource = row.geo_source === 'gps' || row.geo_source === 'ip' ? row.geo_source : null;
    return {
      visitorId: row.visitor_id,
      displayName: row.display_name || guestLabel(row.visitor_id),
      signedIn: !!row.user_id,
      screen: row.screen || 'menu',
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
      lastSeenAt: new Date(row.last_seen_at).toISOString(),
      firstSeenAt: new Date(row.first_seen_at).toISOString(),
    };
  });
}
