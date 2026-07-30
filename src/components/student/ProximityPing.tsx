"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MapPin, X } from "lucide-react";
import ArrivalCheckInSheet, { type ArrivalClass } from "./ArrivalCheckInSheet";

/**
 * Foreground proximity check-in (native wrapper only; no-op on web).
 *
 * Flow on launch/foreground:
 * 1. GET the eligibility context (no location involved). Nothing happens for
 *    academies without saved coordinates or stale memberships.
 * 2. Check the EXISTING location permission state — never auto-prompt:
 *    - granted  -> run a one-shot foreground proximity check
 *    - prompt   -> show a small in-context explainer with an explicit
 *                  "Enable" button ("Not now" persists a cooldown)
 *    - denied   -> do nothing, never re-ask (the rest of the app is unaffected)
 * 3. When the server says we're inside with eligible classes, show the
 *    arrival sheet. The server decision endpoint never notifies the owner —
 *    only a confirmed check-in creates any record.
 */

const EXPLAINER_COOLDOWN_KEY = "matflow-arrival-explainer-dismissed-at";
const ARRIVAL_DEBOUNCE_KEY = "matflow-arrival-sheet-dismissed-at";
const EXPLAINER_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 1 week
const ARRIVAL_DEBOUNCE_MS = 45 * 60 * 1000; // 45 min — one prompt per visit

declare global {
  interface Window {
    Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string };
  }
}

type GeoModule = {
  Geolocation: {
    checkPermissions: () => Promise<{ location: string; coarseLocation?: string }>;
    requestPermissions: () => Promise<{ location: string; coarseLocation?: string }>;
    getCurrentPosition: (opts?: {
      enableHighAccuracy?: boolean;
      maximumAge?: number;
      timeout?: number;
    }) => Promise<{ coords: { latitude: number; longitude: number; accuracy: number } }>;
  };
};

type AppModule = {
  App: {
    addListener: (
      event: "appStateChange",
      cb: (state: { isActive: boolean }) => void,
    ) => Promise<{ remove: () => Promise<void> } | { remove: () => void }>;
  };
};

function withinCooldown(key: string, windowMs: number): boolean {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return false;
    return Date.now() - Number(raw) < windowMs;
  } catch {
    return false;
  }
}

function stampCooldown(key: string) {
  try {
    localStorage.setItem(key, String(Date.now()));
  } catch {
    /* storage unavailable — fine */
  }
}

interface ArrivalState {
  gymName: string;
  arrivalToken: string;
  classes: ArrivalClass[];
}

export default function ProximityPing() {
  const [explainer, setExplainer] = useState<{ gymName: string } | null>(null);
  const [arrival, setArrival] = useState<ArrivalState | null>(null);
  // One prompt per foreground session, even if appStateChange fires repeatedly.
  const promptedThisSession = useRef(false);

  const runProximityCheck = useCallback(async () => {
    try {
      const { Geolocation } = (await import("@capacitor/geolocation")) as unknown as GeoModule;
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: false,
        maximumAge: 60_000,
        timeout: 10_000,
      });
      const res = await fetch("/api/student/proximity-ping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.result === "inside_with_classes" && !promptedThisSession.current) {
        promptedThisSession.current = true;
        setArrival({ gymName: data.gymName, arrivalToken: data.arrivalToken, classes: data.classes });
      }
    } catch {
      /* location or network unavailable — the app works fine without it */
    }
  }, []);

  const evaluate = useCallback(async () => {
    try {
      if (promptedThisSession.current) return;
      if (withinCooldown(ARRIVAL_DEBOUNCE_KEY, ARRIVAL_DEBOUNCE_MS)) return;

      // Eligibility first: no permission machinery for ineligible accounts.
      const ctxRes = await fetch("/api/student/proximity-ping");
      if (!ctxRes.ok) return;
      const ctx = await ctxRes.json();
      if (!ctx.eligible) return;

      const { Geolocation } = (await import("@capacitor/geolocation")) as unknown as GeoModule;
      const perm = await Geolocation.checkPermissions();
      const state = perm.location ?? perm.coarseLocation ?? "prompt";

      if (state === "granted") {
        await runProximityCheck();
        return;
      }
      if (state === "denied") return; // never re-prompt a denial
      // Not determined: explain in-context first; the OS prompt fires only
      // from the explicit Enable tap.
      if (!withinCooldown(EXPLAINER_COOLDOWN_KEY, EXPLAINER_COOLDOWN_MS)) {
        setExplainer({ gymName: ctx.gymName });
      }
    } catch {
      /* never let the bonus feature break the app */
    }
  }, [runProximityCheck]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.Capacitor?.isNativePlatform?.()) return; // web: no behavior

    let removeListener: (() => void) | null = null;
    let cancelled = false;

    const t = setTimeout(() => {
      if (!cancelled) evaluate();
    }, 2500);

    (async () => {
      try {
        const { App } = (await import("@capacitor/app")) as unknown as AppModule;
        const handle = await App.addListener("appStateChange", ({ isActive }) => {
          if (isActive) {
            promptedThisSession.current = false; // a fresh arrival session
            evaluate();
          }
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
  }, [evaluate]);

  async function enableLocation() {
    setExplainer(null);
    try {
      const { Geolocation } = (await import("@capacitor/geolocation")) as unknown as GeoModule;
      const perm = await Geolocation.requestPermissions();
      if (perm.location === "granted" || perm.coarseLocation === "granted") {
        await runProximityCheck();
      }
      // Denied here = the OS answer; we respect it and never loop.
    } catch {
      /* plugin unavailable */
    }
  }

  function dismissExplainer() {
    stampCooldown(EXPLAINER_COOLDOWN_KEY);
    setExplainer(null);
  }

  function closeArrival(reason: "dismissed" | "completed") {
    if (reason === "dismissed") stampCooldown(ARRIVAL_DEBOUNCE_KEY);
    setArrival(null);
  }

  function retryAfterExpiredToken() {
    setArrival(null);
    promptedThisSession.current = false;
    runProximityCheck();
  }

  return (
    <>
      {explainer && (
        <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-[90] px-4">
          <div className="mx-auto flex max-w-md items-center gap-3 rounded-xl border border-white/10 bg-brand-dark p-4 shadow-lg">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-accent/10">
              <MapPin className="h-4 w-4 text-brand-accent" />
            </div>
            <p className="min-w-0 flex-1 text-xs leading-relaxed text-gray-300">
              Turn on location to check in automatically when you arrive at {explainer.gymName}.
            </p>
            <button
              onClick={enableLocation}
              className="shrink-0 rounded-lg bg-brand-accent px-3 py-2 text-xs font-bold text-brand-black transition hover:bg-brand-accent/90"
            >
              Enable
            </button>
            <button
              onClick={dismissExplainer}
              aria-label="Not now"
              className="shrink-0 rounded-md p-1.5 text-gray-500 transition hover:bg-white/5 hover:text-gray-300"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {arrival && (
        <ArrivalCheckInSheet
          gymName={arrival.gymName}
          classes={arrival.classes}
          arrivalToken={arrival.arrivalToken}
          onClose={closeArrival}
          onTokenExpired={retryAfterExpiredToken}
        />
      )}
    </>
  );
}
