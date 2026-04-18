"use client";

import { useEffect } from "react";

/**
 * Keeps the user signed in across iOS/Android app-kills.
 *
 * WKWebView's cookie jar gets wiped when iOS reaps a suspended app
 * (swipe-up close, or memory pressure). Our session cookie is httpOnly,
 * so JS can't read it directly — but we can ask the server for the raw
 * JWT via /api/auth/token, stash it in Capacitor Preferences (iOS
 * UserDefaults / Android SharedPreferences, both durable across app
 * kills), and on next launch re-inject it via /api/auth/restore before
 * the user sees a sign-in redirect.
 *
 * Web/PWA runs are no-ops: normal browser cookie persistence already works.
 */

const STORAGE_KEY = "matflow_session_token";

type BridgeState = {
  mode: "web" | "native";
  ready: boolean;
  lastRun: string;
  lastResult:
    | "stashed"
    | "restored"
    | "restored+redirected"
    | "unauthenticated-no-token"
    | "restore-failed"
    | "error"
    | "idle";
  lastError?: string;
  hasStoredToken?: boolean;
};

declare global {
  interface Window {
    Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string };
    __matflowClearNativeAuth?: () => Promise<void>;
    __matflowStashNativeAuth?: () => Promise<void>;
    __matflowBridgeState?: BridgeState;
  }
}

type PrefsModule = {
  Preferences: {
    get: (opts: { key: string }) => Promise<{ value: string | null }>;
    set: (opts: { key: string; value: string }) => Promise<void>;
    remove: (opts: { key: string }) => Promise<void>;
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

function log(...args: unknown[]) {
  console.log("[NativeSessionBridge]", ...args);
}

// Shared helpers — defined at module scope so both the global window funcs
// and the sync() routine below share the exact same logic.
async function stashCurrentToken(): Promise<boolean> {
  try {
    const { Preferences } = (await import("@capacitor/preferences")) as unknown as PrefsModule;
    const tokenRes = await fetch("/api/auth/token", { cache: "no-store", credentials: "include" });
    if (!tokenRes.ok) {
      log("stash: /api/auth/token returned", tokenRes.status);
      return false;
    }
    const { token } = await tokenRes.json();
    if (typeof token !== "string" || token.length < 10) {
      log("stash: no token in response");
      return false;
    }
    await Preferences.set({ key: STORAGE_KEY, value: token });
    log("stash: token saved, length=", token.length);
    return true;
  } catch (err) {
    log("stash error:", err);
    return false;
  }
}

async function clearStoredToken(): Promise<void> {
  try {
    const { Preferences } = (await import("@capacitor/preferences")) as unknown as PrefsModule;
    await Preferences.remove({ key: STORAGE_KEY });
    log("clear: token removed");
  } catch (err) {
    log("clear error:", err);
  }
}

export default function NativeSessionBridge() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const isNative = window.Capacitor?.isNativePlatform?.() || false;

    // Initialize bridge state for in-app debugging
    window.__matflowBridgeState = {
      mode: isNative ? "native" : "web",
      ready: false,
      lastRun: new Date().toISOString(),
      lastResult: "idle",
    };

    if (!isNative) return;

    // Expose window helpers IMMEDIATELY (before any async work) so login /
    // signup flows that fire right after mount can still use them.
    window.__matflowStashNativeAuth = async () => { await stashCurrentToken(); };
    window.__matflowClearNativeAuth = clearStoredToken;

    let active = true;
    let restoreInFlight = false;

    async function sync() {
      if (!active || restoreInFlight) return;
      try {
        const { Preferences } = (await import("@capacitor/preferences")) as unknown as PrefsModule;

        window.__matflowBridgeState = {
          ...(window.__matflowBridgeState as BridgeState),
          ready: true,
          lastRun: new Date().toISOString(),
        };

        const sessionRes = await fetch("/api/auth/session", { cache: "no-store", credentials: "include" });
        if (!sessionRes.ok) {
          log("sync: session fetch failed", sessionRes.status);
          return;
        }
        const sessionData = await sessionRes.json();
        log("sync: session authenticated=", sessionData.authenticated);

        if (sessionData.authenticated) {
          const ok = await stashCurrentToken();
          window.__matflowBridgeState = {
            ...(window.__matflowBridgeState as BridgeState),
            lastResult: ok ? "stashed" : "error",
            hasStoredToken: ok,
          };
          // Native app always boots at `/` (landing) or `/sign-in` because
          // that's what Capacitor loads. If the user is actually signed in,
          // bounce them to their real dashboard so they don't think they
          // got logged out.
          const path = window.location.pathname;
          const dead =
            path === "/" ||
            path === "/sign-in" ||
            path === "/sign-up" ||
            path === "/forgot-password";
          if (dead) {
            const dest = sessionData?.user?.userType === "student" ? "/student" : "/app";
            log("sync: already authed on landing page — jumping to", dest);
            window.location.replace(dest);
          }
          return;
        }

        // Not authenticated via cookie. Try to restore from Preferences.
        const { value: storedToken } = await Preferences.get({ key: STORAGE_KEY });
        log("sync: stored token present=", !!storedToken);
        if (!storedToken) {
          window.__matflowBridgeState = {
            ...(window.__matflowBridgeState as BridgeState),
            lastResult: "unauthenticated-no-token",
            hasStoredToken: false,
          };
          return;
        }

        restoreInFlight = true;
        const restoreRes = await fetch("/api/auth/restore", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: storedToken }),
          credentials: "include",
        });

        if (!restoreRes.ok) {
          log("sync: restore failed", restoreRes.status);
          await Preferences.remove({ key: STORAGE_KEY });
          restoreInFlight = false;
          window.__matflowBridgeState = {
            ...(window.__matflowBridgeState as BridgeState),
            lastResult: "restore-failed",
            hasStoredToken: false,
          };
          return;
        }

        log("sync: restore succeeded");

        // Figure out where to go — can't just reload because the current URL
        // might be /sign-in or / (landing) which don't redirect authed users.
        try {
          const freshSession = await fetch("/api/auth/session", { cache: "no-store", credentials: "include" });
          if (freshSession.ok) {
            const d = await freshSession.json();
            const dest = d?.user?.userType === "student" ? "/student" : "/app";
            log("sync: redirecting to", dest);
            window.__matflowBridgeState = {
              ...(window.__matflowBridgeState as BridgeState),
              lastResult: "restored+redirected",
              hasStoredToken: true,
            };
            window.location.replace(dest);
            return;
          }
        } catch (err) {
          log("sync: fresh session fetch threw", err);
        }

        // Fallback: reload
        window.__matflowBridgeState = {
          ...(window.__matflowBridgeState as BridgeState),
          lastResult: "restored",
          hasStoredToken: true,
        };
        window.location.reload();
      } catch (err) {
        log("sync: unexpected error", err);
        window.__matflowBridgeState = {
          ...(window.__matflowBridgeState as BridgeState),
          lastResult: "error",
          lastError: err instanceof Error ? err.message : String(err),
        };
        restoreInFlight = false;
      }
    }

    // Run immediately on mount (app launch).
    sync();

    // Run whenever the app comes back to the foreground.
    let removeListener: (() => void) | null = null;
    (async () => {
      try {
        const { App } = (await import("@capacitor/app")) as unknown as AppModule;
        const handle = await App.addListener("appStateChange", ({ isActive }) => {
          if (isActive) sync();
        });
        const rm = (handle as { remove?: () => void | Promise<void> }).remove;
        if (typeof rm === "function") {
          removeListener = () => { void rm.call(handle); };
        }
      } catch {
        /* @capacitor/app unavailable */
      }
    })();

    return () => {
      active = false;
      if (removeListener) removeListener();
    };
  }, []);

  return null;
}
