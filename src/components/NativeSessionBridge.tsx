"use client";

import { useEffect } from "react";

/**
 * Keeps the user signed in across iOS/Android app-kills.
 *
 * WKWebView's cookie jar gets wiped when the OS reaps a suspended app
 * (swipe-up close, or memory pressure), which is why MatFlow was booting
 * users back to the sign-in screen every time they reopened it. Our session
 * cookie is httpOnly, so JS can't read it directly — but we can ask the
 * server for the raw JWT via /api/auth/token, stash it in Capacitor
 * Preferences (iOS UserDefaults / Android SharedPreferences, both durable
 * across app kills), and on next launch re-inject it via /api/auth/restore
 * before the user sees a sign-in redirect.
 *
 * Web/PWA runs are no-ops: normal browser cookie persistence already works.
 */

const STORAGE_KEY = "matflow_session_token";

declare global {
  interface Window {
    Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string };
    __matflowClearNativeAuth?: () => Promise<void>;
    __matflowStashNativeAuth?: () => Promise<void>;
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

export default function NativeSessionBridge() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const isNative = window.Capacitor?.isNativePlatform?.() || false;
    if (!isNative) return;

    let active = true;
    let restoreInFlight = false;

    async function sync() {
      if (!active || restoreInFlight) return;
      try {
        const { Preferences } = (await import("@capacitor/preferences")) as unknown as PrefsModule;

        // Expose a global signout helper so any signOut button can wipe the
        // stored token before firing the logout fetch. Without this, the
        // bridge would "helpfully" re-restore the session right after.
        window.__matflowClearNativeAuth = async () => {
          try {
            await Preferences.remove({ key: STORAGE_KEY });
          } catch {
            /* noop */
          }
        };

        // Exposed so login / signup flows can force a fresh token stash
        // immediately after authentication — the bridge's own sync() only
        // runs on mount + app resume, so without this a fresh sign-in
        // wouldn't get its token persisted until the next app launch.
        window.__matflowStashNativeAuth = async () => {
          try {
            const tokenRes = await fetch("/api/auth/token", { cache: "no-store" });
            if (!tokenRes.ok) return;
            const { token } = await tokenRes.json();
            if (typeof token === "string" && token.length > 10) {
              await Preferences.set({ key: STORAGE_KEY, value: token });
            }
          } catch {
            /* noop */
          }
        };

        const sessionRes = await fetch("/api/auth/session", { cache: "no-store" });
        if (!sessionRes.ok) return;
        const sessionData = await sessionRes.json();

        if (sessionData.authenticated) {
          // We're signed in — refresh our stashed copy of the JWT so we can
          // restore on the next cold boot.
          try {
            const tokenRes = await fetch("/api/auth/token", { cache: "no-store" });
            if (tokenRes.ok) {
              const { token } = await tokenRes.json();
              if (typeof token === "string" && token.length > 10) {
                await Preferences.set({ key: STORAGE_KEY, value: token });
              }
            }
          } catch {
            /* noop */
          }
          return;
        }

        // Not authenticated. Try to restore from Preferences.
        const { value: storedToken } = await Preferences.get({ key: STORAGE_KEY });
        if (!storedToken) return;

        restoreInFlight = true;
        const restoreRes = await fetch("/api/auth/restore", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: storedToken }),
        });

        if (restoreRes.ok) {
          // Cookie is back. Figure out where to send the user — we can't
          // just reload, because the current URL might be /sign-in or /
          // (landing), which don't auto-redirect authenticated users.
          try {
            const freshSession = await fetch("/api/auth/session", { cache: "no-store" });
            if (freshSession.ok) {
              const d = await freshSession.json();
              const dest = d?.user?.userType === "student" ? "/student" : "/app";
              window.location.replace(dest);
              return;
            }
          } catch {
            /* fall through to reload */
          }
          window.location.reload();
        } else {
          // Token is stale/expired — drop it so we stop retrying.
          await Preferences.remove({ key: STORAGE_KEY });
          restoreInFlight = false;
        }
      } catch {
        restoreInFlight = false;
      }
    }

    // Run immediately on mount (app launch).
    sync();

    // Also run whenever the app comes back to the foreground — iOS may have
    // evicted the WebView while we were backgrounded.
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
        /* noop — running in web where @capacitor/app isn't wired */
      }
    })();

    return () => {
      active = false;
      if (removeListener) removeListener();
    };
  }, []);

  return null;
}
