"use client";

import { useEffect } from "react";

/**
 * Two-mode OneSignal bootstrap.
 *
 * 1. **Native wrapper (iOS/Android Capacitor build)**: AppDelegate/Application
 *    already called OneSignal.initialize() at launch. We only need to link
 *    the authenticated MatFlow session to the device via `login(externalId)`.
 *    We detect this mode by checking for Capacitor's bridge on `window`.
 *
 * 2. **Plain web (browser / PWA)**: inject OneSignal's web SDK, init, request
 *    permission, and link external_id. Same flow we've had since the start.
 *
 * External_id = session.userId so the server-side notify() helper targets
 * the right user regardless of where they're signed in.
 */

const APP_ID = (process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || "").trim();
const SAFARI_WEB_ID = (process.env.NEXT_PUBLIC_ONESIGNAL_SAFARI_WEB_ID || "").trim();

declare global {
  interface Window {
    OneSignalDeferred?: Array<(os: unknown) => void>;
    __matflowOneSignalReady?: boolean;
    Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string };
    plugins?: {
      OneSignal?: {
        login: (externalId: string) => void;
        setLanguage?: (lang: string) => void;
      };
    };
  }
}

async function linkSessionToOneSignal(): Promise<void> {
  try {
    const res = await fetch("/api/auth/session", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    const userId = data?.user?.userId;
    if (!data.authenticated || !userId) return;

    // Native mode: Capacitor + OneSignal Cordova plugin at window.plugins.OneSignal
    if (window.Capacitor?.isNativePlatform?.() && window.plugins?.OneSignal) {
      window.plugins.OneSignal.login(userId);
      console.log("[OneSignal] native login", userId.slice(0, 12) + "...");
      return;
    }

    // Web mode: web SDK exposes itself via window.OneSignalDeferred queue
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async function (OneSignal) {
      const os = OneSignal as { login: (id: string) => Promise<void> };
      await os.login(userId);
      console.log("[OneSignal] web login", userId.slice(0, 12) + "...");
    });
  } catch {
    // Silent — push will just target anonymously
  }
}

export default function OneSignalInit() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.__matflowOneSignalReady) return;
    window.__matflowOneSignalReady = true;

    const isNative = window.Capacitor?.isNativePlatform?.() || false;

    if (isNative) {
      // Native wrapper already initialized OneSignal at launch. Just link identity.
      linkSessionToOneSignal();
      return;
    }

    if (!APP_ID) return; // Web mode but no creds → skip

    // Inject the OneSignal Web SDK once
    const existing = document.querySelector('script[data-onesignal="1"]');
    if (!existing) {
      const s = document.createElement("script");
      s.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
      s.async = true;
      s.defer = true;
      s.dataset.onesignal = "1";
      document.head.appendChild(s);
    }

    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async function (OneSignal) {
      const os = OneSignal as {
        init: (opts: Record<string, unknown>) => Promise<void>;
        Notifications: { permission: boolean; requestPermission: () => Promise<void> };
      };
      try {
        await os.init({
          appId: APP_ID,
          safari_web_id: SAFARI_WEB_ID || undefined,
          notifyButton: { enable: false },
          allowLocalhostAsSecureOrigin: true,
          serviceWorkerPath: "/OneSignalSDKWorker.js",
          serviceWorkerParam: { scope: "/" },
        });
        if (!os.Notifications.permission) {
          await os.Notifications.requestPermission();
        }
      } catch (err) {
        console.error("[OneSignal] web init failed:", err);
      }
    });

    // Link identity regardless of whether init fully completes (queued in both paths)
    linkSessionToOneSignal();
  }, []);

  return null;
}
