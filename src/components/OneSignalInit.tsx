"use client";

import { useEffect } from "react";

/**
 * Boots the OneSignal Web SDK and tags the current user with their session
 * userId (external_id) so the server-side push helper can target them.
 *
 * Safe to mount on every page — if credentials aren't set OR the user isn't
 * authenticated, it no-ops.
 *
 * NEXT_PUBLIC_ONESIGNAL_APP_ID and NEXT_PUBLIC_ONESIGNAL_SAFARI_WEB_ID must
 * be set in Vercel env vars. Both are baked at build time, so bumping them
 * requires a fresh deploy (see feedback_push_notifications.md).
 */

// v2 — triggers fresh chunk hash so Vercel picks up env vars on rebuild
const APP_ID = (process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || "").trim();
const SAFARI_WEB_ID = (process.env.NEXT_PUBLIC_ONESIGNAL_SAFARI_WEB_ID || "").trim();

if (typeof window !== "undefined" && APP_ID) {
  console.log("[OneSignal] init v2 — app_id:", APP_ID.slice(0, 8) + "...");
}

declare global {
  interface Window {
    OneSignalDeferred?: Array<(os: unknown) => void>;
    __matflowOneSignalReady?: boolean;
  }
}

export default function OneSignalInit() {
  useEffect(() => {
    if (!APP_ID) return; // No creds → skip entirely, don't even inject the SDK
    if (typeof window === "undefined") return;
    if (window.__matflowOneSignalReady) return;
    window.__matflowOneSignalReady = true;

    // 1. Inject the OneSignal SDK script once
    const existing = document.querySelector('script[data-onesignal="1"]');
    if (!existing) {
      const s = document.createElement("script");
      s.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
      s.async = true;
      s.defer = true;
      s.dataset.onesignal = "1";
      document.head.appendChild(s);
    }

    // 2. Queue init — the SDK drains this array on load
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async function (OneSignal) {
      const os = OneSignal as {
        init: (opts: Record<string, unknown>) => Promise<void>;
        login: (externalId: string) => Promise<void>;
        logout: () => Promise<void>;
        Notifications: {
          permission: boolean;
          requestPermission: () => Promise<void>;
        };
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

        // 3. Link the current MatFlow session to OneSignal via external_id
        const sessionRes = await fetch("/api/auth/session", { cache: "no-store" });
        if (sessionRes.ok) {
          const data = await sessionRes.json();
          if (data.authenticated && data.user?.userId) {
            await os.login(data.user.userId);
          }
        }

        // 4. Auto-prompt for permission if we don't have it yet. iOS PWA
        // requires this gesture to happen after the page is interactive.
        if (!os.Notifications.permission) {
          await os.Notifications.requestPermission();
        }
      } catch (err) {
        console.error("[OneSignal] init failed:", err);
      }
    });
  }, []);

  return null;
}
