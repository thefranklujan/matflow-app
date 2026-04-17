"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

type PermissionState = "granted" | "denied" | "default" | "unsupported";

interface OneSignalHandle {
  Notifications: {
    permission: boolean;
    permissionNative?: NotificationPermission;
    requestPermission: () => Promise<void>;
  };
  User: {
    PushSubscription: {
      optIn: () => Promise<void>;
      optOut: () => Promise<void>;
      optedIn: boolean;
    };
  };
}

declare global {
  interface Window {
    OneSignal?: OneSignalHandle;
  }
}

async function waitForOneSignal(timeoutMs = 4000): Promise<OneSignalHandle | null> {
  const started = Date.now();
  return new Promise((resolve) => {
    const poll = () => {
      if (window.OneSignal) return resolve(window.OneSignal);
      if (Date.now() - started > timeoutMs) return resolve(null);
      setTimeout(poll, 100);
    };
    poll();
  });
}

/**
 * Notification preferences surface. Shows push permission state, a master
 * enable/disable toggle, a test-notification button, and the list of
 * categories MatFlow will send. Category-level opt-outs are planned but
 * require a schema column (see TODO) — for now the master toggle is it.
 */
export default function NotificationSettings() {
  const [permission, setPermission] = useState<PermissionState>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission as PermissionState);
    (async () => {
      const os = await waitForOneSignal();
      if (os) setSubscribed(os.User.PushSubscription.optedIn);
    })();
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const os = await waitForOneSignal();
      if (!os) throw new Error("OneSignal not loaded");
      if (Notification.permission !== "granted") {
        await os.Notifications.requestPermission();
      }
      await os.User.PushSubscription.optIn();
      setSubscribed(true);
      setPermission(Notification.permission as PermissionState);
      toast.success("Notifications enabled");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to enable");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const os = await waitForOneSignal();
      if (!os) throw new Error("OneSignal not loaded");
      await os.User.PushSubscription.optOut();
      setSubscribed(false);
      toast("Notifications disabled");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to disable");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setTesting(true);
    try {
      const res = await fetch("/api/notifications/test", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Test failed");
      toast.success("Test push sent", {
        description: "Check your device in a few seconds.",
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Test failed");
    } finally {
      setTesting(false);
    }
  }

  const canEnable = permission !== "denied" && permission !== "unsupported";

  return (
    <div className="space-y-4">
      <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div
              className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${
                subscribed ? "bg-emerald-500/10 text-emerald-400" : "bg-white/5 text-gray-400"
              }`}
            >
              {subscribed ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
            </div>
            <div>
              <p className="text-white font-semibold">Push notifications</p>
              <p className="text-gray-400 text-sm">
                {permission === "unsupported" && "This browser doesn't support push notifications."}
                {permission === "denied" &&
                  "You blocked notifications. Re-enable them in your browser settings to turn on."}
                {permission === "default" &&
                  "Allow notifications to get pinged for announcements, belt promotions, and class reminders."}
                {permission === "granted" && subscribed && "You'll get pinged on this device."}
                {permission === "granted" && !subscribed && "Permission granted, but you're opted out."}
              </p>
            </div>
          </div>
          <div className="shrink-0">
            {subscribed ? (
              <button
                onClick={disable}
                disabled={busy}
                className="px-4 py-2 rounded-lg bg-white/5 text-gray-300 text-sm font-medium hover:bg-white/10 transition disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Turn off"}
              </button>
            ) : (
              <button
                onClick={enable}
                disabled={busy || !canEnable}
                className="px-4 py-2 rounded-lg bg-[#c4b5a0] text-black text-sm font-bold hover:bg-[#b5a591] transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Turn on"}
              </button>
            )}
          </div>
        </div>

        {subscribed && (
          <div className="mt-4 pt-4 border-t border-white/5">
            <button
              onClick={test}
              disabled={testing}
              className="text-sm text-[#c4b5a0] hover:text-[#b5a591] font-medium disabled:opacity-50"
            >
              {testing ? "Sending..." : "Send me a test notification"}
            </button>
          </div>
        )}
      </div>

      <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-5">
        <p className="text-white font-semibold mb-3">What you&apos;ll get pinged about</p>
        <ul className="space-y-2 text-sm">
          {[
            { on: true, label: "Announcements from your gym" },
            { on: true, label: "Join request status (submitted, approved, rejected)" },
            { on: true, label: "Belt promotions" },
            { on: true, label: "New waivers requiring signature" },
            { on: false, label: "Class reminders (coming soon)" },
            { on: false, label: "Community replies (coming soon)" },
          ].map((row) => (
            <li key={row.label} className="flex items-center gap-2">
              {row.on ? (
                <Check className="h-4 w-4 text-emerald-400 shrink-0" />
              ) : (
                <X className="h-4 w-4 text-gray-600 shrink-0" />
              )}
              <span className={row.on ? "text-gray-300" : "text-gray-600"}>{row.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
