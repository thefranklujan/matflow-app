"use client";

import { useEffect } from "react";

/**
 * Runs in the student native wrapper. When the app foregrounds we grab a one-
 * shot position, POST it to /api/student/proximity-ping, and let the server
 * decide whether the student has "arrived" at their gym (Haversine check vs
 * saved geofence). The server handles rate limiting + notifying the owner.
 *
 * No-op on web — location access in a desktop browser isn't useful here and
 * the PWA location prompt is poor UX.
 */

declare global {
  interface Window {
    Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string };
  }
}

type GeoModule = {
  Geolocation: {
    requestPermissions: () => Promise<{ location: string; coarseLocation?: string }>;
    getCurrentPosition: (opts?: {
      enableHighAccuracy?: boolean;
      maximumAge?: number;
      timeout?: number;
    }) => Promise<{
      coords: { latitude: number; longitude: number; accuracy: number };
    }>;
  };
};

type AppModule = {
  App: {
    addListener: (
      event: "appStateChange",
      cb: (state: { isActive: boolean }) => void
    ) => Promise<{ remove: () => Promise<void> } | { remove: () => void }>;
  };
};

async function pingOnce(): Promise<void> {
  try {
    const { Geolocation } = (await import("@capacitor/geolocation")) as unknown as GeoModule;
    const perm = await Geolocation.requestPermissions();
    if (perm.location !== "granted" && perm.coarseLocation !== "granted") return;

    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: false,
      maximumAge: 60_000,
      timeout: 10_000,
    });

    await fetch("/api/student/proximity-ping", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      }),
    });
  } catch {
    /* silent — location is a bonus feature */
  }
}

export default function ProximityPing() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.Capacitor?.isNativePlatform?.()) return;

    let removeListener: (() => void) | null = null;
    let cancelled = false;

    // First ping a couple seconds after launch so OS has time to settle
    const t = setTimeout(() => { if (!cancelled) pingOnce(); }, 2500);

    (async () => {
      try {
        const { App } = (await import("@capacitor/app")) as unknown as AppModule;
        const handle = await App.addListener("appStateChange", ({ isActive }) => {
          if (isActive) pingOnce();
        });
        const rm = (handle as { remove?: () => void | Promise<void> }).remove;
        if (typeof rm === "function") {
          removeListener = () => { void rm.call(handle); };
        }
      } catch {
        /* @capacitor/app unavailable; ignore */
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(t);
      if (removeListener) removeListener();
    };
  }, []);

  return null;
}
