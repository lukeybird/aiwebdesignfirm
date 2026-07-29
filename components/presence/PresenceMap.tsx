'use client';

import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export type MapVisitor = {
  visitorId: string;
  displayName: string;
  latitude?: number | null;
  longitude?: number | null;
  accuracyM?: number | null;
  preciseLocation?: string | null;
  location?: string | null;
  geoSource?: 'gps' | 'ip' | null;
  mapsUrl?: string | null;
  screen?: string;
  ipAddress?: string | null;
};

type Props = {
  visitors: MapVisitor[];
  className?: string;
};

function pinIcon(isGps: boolean) {
  const color = isGps ? '#34d399' : '#fbbf24';
  const html = `
    <div style="
      width:18px;height:18px;border-radius:9999px;
      background:${color};border:2px solid #fff;
      box-shadow:0 0 0 3px rgba(0,0,0,0.35),0 6px 16px rgba(0,0,0,0.45);
    "></div>`;
  return L.divIcon({
    className: 'presence-pin',
    html,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -10],
  });
}

export default function PresenceMap({ visitors, className = '' }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  const points = useMemo(
    () =>
      visitors.filter(
        (v) =>
          v.latitude != null
          && v.longitude != null
          && Number.isFinite(v.latitude)
          && Number.isFinite(v.longitude),
      ),
    [visitors],
  );

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true,
      worldCopyJump: true,
    }).setView([20, 0], 2);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      maxZoom: 20,
      subdomains: 'abcd',
    }).addTo(map);

    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    const resize = () => map.invalidateSize();
    window.addEventListener('resize', resize);
    // Leaflet needs a tick after layout.
    setTimeout(resize, 80);

    return () => {
      window.removeEventListener('resize', resize);
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    if (!points.length) {
      map.setView([20, 0], 2);
      return;
    }

    const bounds = L.latLngBounds([]);
    for (const v of points) {
      const lat = v.latitude as number;
      const lng = v.longitude as number;
      const isGps = v.geoSource === 'gps';
      const marker = L.marker([lat, lng], { icon: pinIcon(isGps) });

      const accuracy = v.accuracyM != null && v.accuracyM > 0
        ? Math.min(v.accuracyM, 5000)
        : null;
      if (accuracy && isGps) {
        L.circle([lat, lng], {
          radius: accuracy,
          color: '#34d399',
          weight: 1,
          opacity: 0.7,
          fillColor: '#34d399',
          fillOpacity: 0.12,
        }).addTo(layer);
      }

      const place = v.preciseLocation || v.location || 'Unknown place';
      const accLabel = v.accuracyM != null ? `±${Math.round(v.accuracyM)}m` : '—';
      const mapLink = v.mapsUrl
        || `https://www.google.com/maps?q=${lat},${lng}`;

      marker.bindPopup(
        `<div style="min-width:180px;font:12px/1.4 system-ui,sans-serif">
          <strong style="font-size:13px">${escapeHtml(v.displayName)}</strong><br/>
          <span style="opacity:.75">${escapeHtml(place)}</span><br/>
          <code style="font-size:11px">${lat.toFixed(6)}, ${lng.toFixed(6)}</code><br/>
          <span style="opacity:.7">${isGps ? 'Live GPS' : 'Approx'} · ${accLabel}</span><br/>
          <span style="opacity:.55">${escapeHtml(v.screen || '')}${v.ipAddress ? ` · IP ${escapeHtml(v.ipAddress)}` : ''}</span><br/>
          <a href="${mapLink}" target="_blank" rel="noreferrer" style="color:#34d399">Open in Google Maps</a>
        </div>`,
        { maxWidth: 280 },
      );
      marker.addTo(layer);
      bounds.extend([lat, lng]);
    }

    if (points.length === 1) {
      const only = points[0];
      const zoom = only.geoSource === 'gps' && (only.accuracyM ?? 999) < 80 ? 17 : 13;
      map.setView([only.latitude as number, only.longitude as number], zoom);
    } else {
      map.fitBounds(bounds.pad(0.25), { maxZoom: 16 });
    }

    setTimeout(() => map.invalidateSize(), 50);
  }, [points]);

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-white/10 ${className}`}>
      <div ref={containerRef} className="h-[min(62vh,560px)] w-full bg-[#0b1220]" />
      {!points.length && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/35 px-6 text-center">
          <p className="max-w-sm text-sm text-white/70">
            No live GPS pins yet. When a visitor allows location, they appear here at street-level zoom.
          </p>
        </div>
      )}
      <div className="absolute bottom-3 left-3 z-[500] rounded-lg border border-white/10 bg-black/70 px-2.5 py-1.5 text-[11px] text-white/70 backdrop-blur">
        <span className="mr-3 inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-400" /> GPS
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-400" /> IP / approx
        </span>
        <span className="ml-3 text-white/40">{points.length} pinned</span>
      </div>
    </div>
  );
}

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
