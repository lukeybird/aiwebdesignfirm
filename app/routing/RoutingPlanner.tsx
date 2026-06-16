'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, MapPin, Navigation, Route } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

type RouteStop = {
  input: string;
  displayName: string;
  lat: number;
  lon: number;
  originalIndex: number;
  order: number;
};

type RouteResult = {
  stops: RouteStop[];
  routeCoordinates: [number, number][];
  distanceMiles: number;
  durationMinutes: number;
  googleMapsUrl: string;
};

type LeafletGlobal = {
  map: (element: HTMLElement, options?: Record<string, unknown>) => any;
  tileLayer: (url: string, options?: Record<string, unknown>) => any;
  marker: (latLng: [number, number], options?: Record<string, unknown>) => any;
  polyline: (latLngs: [number, number][], options?: Record<string, unknown>) => any;
  divIcon: (options?: Record<string, unknown>) => any;
  latLngBounds: (latLngs: [number, number][]) => any;
};

declare global {
  interface Window {
    L?: LeafletGlobal;
    __routingLeafletPromise?: Promise<LeafletGlobal>;
  }
}

const SAMPLE_ADDRESSES = `401 W Peachtree St NW, Atlanta, GA 30308
5701 Executive Center Dr, Charlotte, NC 28212
15 Security Dr, Greenville, SC 29611
3093 Everdale Dr, San Jose, CA 95148`;

function loadLeaflet(): Promise<LeafletGlobal> {
  if (window.L) return Promise.resolve(window.L);
  if (window.__routingLeafletPromise) return window.__routingLeafletPromise;

  window.__routingLeafletPromise = new Promise((resolve, reject) => {
    const existingCss = document.querySelector('link[data-routing-leaflet]');
    if (!existingCss) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.setAttribute('data-routing-leaflet', 'true');
      document.head.appendChild(link);
    }

    const existingScript = document.querySelector('script[data-routing-leaflet]');
    if (existingScript) {
      existingScript.addEventListener('load', () => (window.L ? resolve(window.L) : reject(new Error('Map failed to load'))));
      existingScript.addEventListener('error', () => reject(new Error('Map failed to load')));
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.setAttribute('data-routing-leaflet', 'true');
    script.onload = () => (window.L ? resolve(window.L) : reject(new Error('Map failed to load')));
    script.onerror = () => reject(new Error('Map failed to load'));
    document.body.appendChild(script);
  });

  return window.__routingLeafletPromise;
}

function formatDuration(minutes: number) {
  const rounded = Math.round(minutes);
  const hours = Math.floor(rounded / 60);
  const mins = rounded % 60;
  if (hours <= 0) return `${mins} min`;
  return `${hours} hr ${mins} min`;
}

export default function RoutingPlanner() {
  const [addressesText, setAddressesText] = useState('');
  const [returnToStart, setReturnToStart] = useState(false);
  const [result, setResult] = useState<RouteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mapElRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const layerRefs = useRef<any[]>([]);

  const parsedAddresses = useMemo(
    () =>
      addressesText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
    [addressesText],
  );

  async function optimizeRoute() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/routing/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addresses: parsedAddresses, returnToStart }),
      });
      const payload = (await res.json()) as RouteResult & { error?: string };
      if (!res.ok) throw new Error(payload.error || 'Could not create route.');
      setResult(payload);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create route.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function drawMap() {
      if (!mapElRef.current || !result) return;
      const L = await loadLeaflet();
      if (cancelled || !mapElRef.current) return;

      if (!mapRef.current) {
        mapRef.current = L.map(mapElRef.current, {
          zoomControl: true,
          scrollWheelZoom: true,
        });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(mapRef.current);
      }

      layerRefs.current.forEach((layer) => layer.remove());
      layerRefs.current = [];

      if (result.routeCoordinates.length > 0) {
        const routeLayer = L.polyline(result.routeCoordinates, {
          color: '#00d4ff',
          weight: 6,
          opacity: 0.9,
        }).addTo(mapRef.current);
        layerRefs.current.push(routeLayer);

        const bounds = L.latLngBounds(result.routeCoordinates);
        mapRef.current.fitBounds(bounds, { padding: [28, 28] });
      }

      result.stops.forEach((stop, index) => {
        const marker = L.marker([stop.lat, stop.lon], {
          icon: L.divIcon({
            className: '',
            html: `<div style="height:30px;width:30px;border-radius:9999px;background:#00d4ff;color:#00111a;font-weight:900;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 8px 24px rgba(0,0,0,.45)">${index + 1}</div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15],
          }),
        }).addTo(mapRef.current);
        marker.bindPopup(`<strong>Stop ${index + 1}</strong><br/>${stop.displayName}`);
        layerRefs.current.push(marker);
      });
    }

    void drawMap();

    return () => {
      cancelled = true;
    };
  }, [result]);

  return (
    <main className="min-h-[100dvh] bg-[#0a0a0f] text-white">
      <div className="mx-auto grid w-full max-w-[1500px] gap-6 px-4 py-6 lg:grid-cols-[28rem_minmax(0,1fr)] lg:px-6">
        <section className="rounded-2xl border border-white/10 bg-[#071325]/95 p-4 shadow-[0_24px_80px_-40px_rgba(0,0,0,0.8)] lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)] lg:overflow-y-auto">
          <div className="mb-5 border-b border-white/10 pb-4">
            <p className="flex items-center gap-2 text-lg font-black text-white">
              <Route className="h-5 w-5 text-cyan-300" aria-hidden />
              Route Planner
            </p>
            <p className="mt-1 text-sm leading-relaxed text-gray-400">
              Put one address per line. The first line is the starting point. If you do not return to start, the last line is the final destination.
            </p>
          </div>

          <label className="block">
            <span className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-cyan-200/70">Addresses</span>
            <Textarea
              value={addressesText}
              onChange={(e) => setAddressesText(e.target.value)}
              placeholder="One address per line..."
              className="min-h-[240px] resize-y border-white/15 bg-black/35 text-sm text-white placeholder:text-gray-500"
            />
          </label>

          <div className="mt-3 flex items-start gap-2 rounded-xl border border-white/10 bg-black/25 p-3">
            <input
              id="return-to-start"
              type="checkbox"
              checked={returnToStart}
              onChange={(e) => setReturnToStart(e.target.checked)}
              className="mt-1 h-4 w-4 accent-cyan-400"
            />
            <label htmlFor="return-to-start" className="text-sm leading-relaxed text-gray-300">
              Return to the starting address at the end.
            </label>
          </div>

          {error ? (
            <div className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">{error}</div>
          ) : null}

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              className="flex-1 bg-gradient-to-r from-[#0066ff] to-[#00d4ff] text-black hover:opacity-95"
              disabled={loading || parsedAddresses.length < 2}
              onClick={() => void optimizeRoute()}
            >
              <Navigation className="h-4 w-4" />
              {loading ? 'Optimizing...' : 'Create Best Route'}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-white/15 bg-white/5 text-white hover:bg-white/10"
              onClick={() => setAddressesText(SAMPLE_ADDRESSES)}
            >
              Sample
            </Button>
          </div>

          <p className="mt-4 text-xs leading-relaxed text-gray-500">
            Uses OpenStreetMap geocoding and OSRM driving routes. For heavy daily business use, this can be upgraded to Google Maps or Mapbox with an API key.
          </p>
        </section>

        <section className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#071325] shadow-2xl">
            <div ref={mapElRef} className="h-[58dvh] min-h-[28rem] w-full bg-[#0b1220]" />
          </div>

          {result ? (
            <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
              <div className="rounded-2xl border border-white/10 bg-[#071325]/95 p-4">
                <div className="mb-4 flex flex-col gap-3 border-b border-white/10 pb-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-xl font-black text-white">Optimized Route</h2>
                    <p className="mt-1 text-sm text-gray-400">
                      {result.distanceMiles.toFixed(1)} miles · {formatDuration(result.durationMinutes)}
                    </p>
                  </div>
                  <a
                    href={result.googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-black hover:bg-cyan-100"
                  >
                    Open in Google Maps
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>

                <ol className="space-y-2">
                  {result.stops.map((stop, index) => (
                    <li key={`${stop.originalIndex}-${index}`} className="flex gap-3 rounded-xl border border-white/10 bg-black/25 p-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-400 text-sm font-black text-black">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="font-semibold text-white">{stop.input}</p>
                        <p className="mt-1 text-xs leading-relaxed text-gray-500">{stop.displayName}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#071325]/95 p-4">
                <p className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.16em] text-cyan-200/70">
                  <MapPin className="h-4 w-4" />
                  Tips
                </p>
                <ul className="space-y-3 text-sm leading-relaxed text-gray-400">
                  <li>Use full street address, city, and state for best results.</li>
                  <li>Put your starting location on line 1.</li>
                  <li>If not returning to start, put your desired final stop on the last line.</li>
                  <li>Use the Google Maps button for live turn-by-turn navigation.</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-[#071325]/80 p-6 text-center text-gray-400">
              Enter addresses and create a route to see the optimized order here.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
