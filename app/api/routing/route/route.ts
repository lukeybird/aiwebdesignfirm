import { NextRequest, NextResponse } from 'next/server';

type GeocodedStop = {
  input: string;
  displayName: string;
  lat: number;
  lon: number;
};

type OsrmTripResponse = {
  code: string;
  message?: string;
  trips?: Array<{
    distance: number;
    duration: number;
    geometry: {
      coordinates: [number, number][];
    };
  }>;
  waypoints?: Array<{
    waypoint_index: number;
    trips_index: number;
    name: string;
    location: [number, number];
  }>;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function geocodeAddress(address: string): Promise<GeocodedStop> {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '1');
  url.searchParams.set('q', address);

  const res = await fetch(url.toString(), {
    headers: {
      'User-Agent': 'AiWebDesignFirm routing tool (contact: contact@aiwebdesignfirm.com)',
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`Could not geocode "${address}"`);
  }

  const data = (await res.json()) as Array<{
    display_name?: string;
    lat?: string;
    lon?: string;
  }>;

  const first = data[0];
  if (!first?.lat || !first?.lon) {
    throw new Error(`No location found for "${address}"`);
  }

  return {
    input: address,
    displayName: first.display_name || address,
    lat: Number(first.lat),
    lon: Number(first.lon),
  };
}

function buildGoogleMapsUrl(stops: GeocodedStop[], returnToStart: boolean) {
  if (stops.length === 0) return 'https://www.google.com/maps';
  if (stops.length === 1) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stops[0].displayName)}`;
  }

  const origin = stops[0].displayName;
  const destination = returnToStart ? stops[0].displayName : stops[stops.length - 1].displayName;
  const waypointStops = returnToStart ? stops.slice(1) : stops.slice(1, -1);

  const url = new URL('https://www.google.com/maps/dir/');
  url.searchParams.set('api', '1');
  url.searchParams.set('origin', origin);
  url.searchParams.set('destination', destination);
  if (waypointStops.length > 0) {
    url.searchParams.set('waypoints', waypointStops.map((s) => s.displayName).join('|'));
  }
  url.searchParams.set('travelmode', 'driving');
  return url.toString();
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      addresses?: string[];
      returnToStart?: boolean;
    };

    const addresses = (body.addresses ?? [])
      .map((a) => (typeof a === 'string' ? a.trim() : ''))
      .filter(Boolean);
    const returnToStart = Boolean(body.returnToStart);

    if (addresses.length < 2) {
      return NextResponse.json({ error: 'Enter at least 2 addresses.' }, { status: 400 });
    }
    if (addresses.length > 25) {
      return NextResponse.json({ error: 'Please use 25 addresses or fewer at a time.' }, { status: 400 });
    }

    const geocoded: GeocodedStop[] = [];
    for (const address of addresses) {
      geocoded.push(await geocodeAddress(address));
      // Keep public geocoding usage gentle.
      if (addresses.length > 1) await sleep(350);
    }

    const coords = geocoded.map((s) => `${s.lon},${s.lat}`).join(';');
    const tripUrl = new URL(`https://router.project-osrm.org/trip/v1/driving/${coords}`);
    tripUrl.searchParams.set('overview', 'full');
    tripUrl.searchParams.set('geometries', 'geojson');
    tripUrl.searchParams.set('steps', 'false');

    if (returnToStart) {
      tripUrl.searchParams.set('roundtrip', 'true');
      tripUrl.searchParams.set('source', 'first');
      tripUrl.searchParams.set('destination', 'any');
    } else {
      tripUrl.searchParams.set('roundtrip', 'false');
      tripUrl.searchParams.set('source', 'first');
      tripUrl.searchParams.set('destination', 'last');
    }

    const routeRes = await fetch(tripUrl.toString(), {
      headers: { Accept: 'application/json' },
    });
    if (!routeRes.ok) {
      throw new Error('Routing service did not respond.');
    }

    const routeData = (await routeRes.json()) as OsrmTripResponse;
    if (routeData.code !== 'Ok' || !routeData.trips?.[0] || !routeData.waypoints) {
      throw new Error(routeData.message || 'Could not optimize route.');
    }

    const orderedStops = geocoded
      .map((stop, index) => ({
        ...stop,
        originalIndex: index,
        order: routeData.waypoints?.[index]?.waypoint_index ?? index,
      }))
      .sort((a, b) => a.order - b.order);

    const googleMapsUrl = buildGoogleMapsUrl(orderedStops, returnToStart);

    if (returnToStart) {
      orderedStops.push({ ...orderedStops[0], order: orderedStops.length, originalIndex: orderedStops[0].originalIndex });
    }

    const routeCoordinates = routeData.trips[0].geometry.coordinates.map(([lon, lat]) => [lat, lon]);

    return NextResponse.json({
      stops: orderedStops,
      routeCoordinates,
      distanceMiles: routeData.trips[0].distance / 1609.344,
      durationMinutes: routeData.trips[0].duration / 60,
      googleMapsUrl,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unexpected routing error.';
    console.error('POST /api/routing/route:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
