import type { NextRequest } from 'next/server';

export type ClientGeo = {
  ip: string;
  city: string | null;
  region: string | null;
  country: string | null;
  locationLabel: string | null;
};

function firstForwardedIp(header: string | null): string | null {
  if (!header) return null;
  const first = header.split(',')[0]?.trim();
  if (!first) return null;
  // Strip IPv6 brackets / port if present (rare).
  return first.replace(/^\[|\]$/g, '').split('%')[0] || null;
}

export function getClientIp(request: NextRequest): string {
  const vercel = request.headers.get('x-vercel-forwarded-for')
    || request.headers.get('x-real-ip')
    || request.headers.get('cf-connecting-ip');
  const fromVercel = firstForwardedIp(vercel);
  if (fromVercel) return fromVercel.slice(0, 64);

  const forwarded = firstForwardedIp(request.headers.get('x-forwarded-for'));
  if (forwarded) return forwarded.slice(0, 64);

  // NextRequest.ip exists on some runtimes.
  const reqIp = (request as NextRequest & { ip?: string }).ip;
  if (reqIp) return String(reqIp).slice(0, 64);

  return 'unknown';
}

function isPrivateOrLocal(ip: string): boolean {
  if (!ip || ip === 'unknown') return true;
  if (ip === '::1' || ip === '127.0.0.1' || ip === 'localhost') return true;
  if (ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('fc') || ip.startsWith('fd')) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)) return true;
  return false;
}

function formatLocation(city: string | null, region: string | null, country: string | null): string | null {
  const parts = [city, region, country].filter((p): p is string => !!p && p.trim().length > 0);
  if (!parts.length) return null;
  // Dedupe adjacent duplicates (e.g. city === region).
  const uniq: string[] = [];
  for (const p of parts) {
    if (!uniq.length || uniq[uniq.length - 1].toLowerCase() !== p.toLowerCase()) uniq.push(p);
  }
  return uniq.join(', ').slice(0, 120);
}

/** Prefer Vercel edge geo headers (no external call). */
export function geoFromVercelHeaders(request: NextRequest): Omit<ClientGeo, 'ip'> {
  const city = request.headers.get('x-vercel-ip-city');
  const region = request.headers.get('x-vercel-ip-country-region');
  const country = request.headers.get('x-vercel-ip-country');
  const decodedCity = city ? decodeURIComponent(city) : null;
  return {
    city: decodedCity,
    region,
    country,
    locationLabel: formatLocation(decodedCity, region, country),
  };
}

async function lookupIpApi(ip: string): Promise<Omit<ClientGeo, 'ip'> | null> {
  if (isPrivateOrLocal(ip)) {
    return {
      city: null,
      region: null,
      country: null,
      locationLabel: 'Local / private network',
    };
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1800);
    const res = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, {
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      success?: boolean;
      country?: string;
      region?: string;
      city?: string;
    };
    if (data.success === false) return null;
    const city = data.city || null;
    const region = data.region || null;
    const country = data.country || null;
    return {
      city,
      region,
      country,
      locationLabel: formatLocation(city, region, country),
    };
  } catch {
    return null;
  }
}

/** Resolve IP + approximate location for a presence heartbeat. */
export async function resolveClientGeo(request: NextRequest): Promise<ClientGeo> {
  const ip = getClientIp(request);
  const fromVercel = geoFromVercelHeaders(request);
  if (fromVercel.locationLabel) {
    return { ip, ...fromVercel };
  }

  const lookedUp = await lookupIpApi(ip);
  if (lookedUp) return { ip, ...lookedUp };

  return {
    ip,
    city: null,
    region: null,
    country: null,
    locationLabel: isPrivateOrLocal(ip) ? 'Local / private network' : null,
  };
}
