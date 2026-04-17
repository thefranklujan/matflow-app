"use client";

import { useEffect, useState } from "react";

export type UnreadCounts = Record<string, number>;

/**
 * Polls /api/app/unread-counts every 10 seconds. Returns a map of
 * slug → count that the sidebar can render badges from.
 *
 * Keeps the previous value during re-fetches so badges don't flicker.
 * Pauses polling when the tab is hidden (visibilitychange) to save quota.
 */
export function useUnreadCounts(intervalMs = 10_000): UnreadCounts {
  const [counts, setCounts] = useState<UnreadCounts>({});

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function tick() {
      try {
        const res = await fetch("/api/app/unread-counts", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data.counts) setCounts(data.counts);
      } catch {
        // Silent — badges simply don't update on network failure
      } finally {
        if (!cancelled && !document.hidden) {
          timer = setTimeout(tick, intervalMs);
        }
      }
    }

    function onVisibility() {
      if (document.hidden) {
        if (timer) clearTimeout(timer);
      } else {
        tick();
      }
    }

    tick();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [intervalMs]);

  return counts;
}
