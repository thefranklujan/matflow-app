"use client";

import { useEffect } from "react";
import { useUnreadCounts } from "@/lib/useUnreadCounts";

interface BadgingApi {
  setAppBadge?: (count?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
}

/**
 * Mirrors the in-app unread count onto the iOS/Android home-screen icon
 * badge via the Badging API (supported in iOS 16.4+ and recent Chrome).
 * Mounted globally so every route keeps the badge accurate.
 */
export default function NotificationBadgeSync() {
  const unread = useUnreadCounts();
  const notifications = unread.notifications || 0;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const nav = navigator as Navigator & BadgingApi;
    if (!nav.setAppBadge) return;
    if (notifications > 0) {
      nav.setAppBadge(notifications).catch(() => {});
    } else if (nav.clearAppBadge) {
      nav.clearAppBadge().catch(() => {});
    }
  }, [notifications]);

  return null;
}
