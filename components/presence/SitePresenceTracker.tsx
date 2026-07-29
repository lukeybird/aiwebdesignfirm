'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

const STORAGE_KEY = 'tdg_presence_visitor_id';
const PING_MS = 15000;

function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function getVisitorId() {
  try {
    let id = localStorage.getItem(STORAGE_KEY);
    if (!id || id.length < 8) {
      id = uuid();
      localStorage.setItem(STORAGE_KEY, id);
    }
    return id;
  } catch {
    return uuid();
  }
}

/**
 * Site-wide presence + GPS so /activity can map everyone on the website,
 * not only people inside /TDG.
 */
export default function SitePresenceTracker() {
  const pathname = usePathname();
  const gpsRef = useRef<{ lat: number; lng: number; accuracy: number } | null>(null);
  const watchRef = useRef<number | null>(null);

  useEffect(() => {
    // /TDG has its own presence.js — avoid double-ping storms.
    if (pathname?.startsWith('/TDG') || pathname?.startsWith('/tdg')) return;
    // Don't track the monitor itself as a "visitor" noise (still ok if you want — skip activity).
    if (pathname?.startsWith('/activity')) return;

    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const onGeo = (pos: GeolocationPosition) => {
      gpsRef.current = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      };
    };

    if (navigator.geolocation) {
      try {
        navigator.geolocation.getCurrentPosition(onGeo, () => {}, {
          enableHighAccuracy: true,
          maximumAge: 5000,
          timeout: 12000,
        });
        watchRef.current = navigator.geolocation.watchPosition(onGeo, () => {}, {
          enableHighAccuracy: true,
          maximumAge: 20000,
          timeout: 20000,
        });
      } catch {
        // ignore
      }
    }

    const screenLabel = () => {
      const p = pathname || '/';
      if (p === '/') return 'home';
      return p.replace(/^\//, '').slice(0, 40) || 'site';
    };

    const ping = async (leave = false) => {
      if (cancelled) return;
      const body: Record<string, unknown> = leave
        ? { visitorId: getVisitorId(), leave: true }
        : {
            visitorId: getVisitorId(),
            screen: screenLabel(),
            displayName: null,
          };
      if (!leave && gpsRef.current) {
        body.lat = gpsRef.current.lat;
        body.lng = gpsRef.current.lng;
        body.accuracy = gpsRef.current.accuracy;
      }
      try {
        if (leave && navigator.sendBeacon) {
          navigator.sendBeacon(
            '/api/tdg-pvp/presence',
            new Blob([JSON.stringify(body)], { type: 'application/json' }),
          );
          return;
        }
        await fetch('/api/tdg-pvp/presence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(body),
          keepalive: leave,
        });
      } catch {
        // ignore
      }
    };

    void ping(false);
    timer = setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      void ping(false);
    }, PING_MS);

    const onHide = () => void ping(true);
    window.addEventListener('pagehide', onHide);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      window.removeEventListener('pagehide', onHide);
      if (watchRef.current != null && navigator.geolocation?.clearWatch) {
        try {
          navigator.geolocation.clearWatch(watchRef.current);
        } catch {
          // ignore
        }
      }
    };
  }, [pathname]);

  return null;
}
