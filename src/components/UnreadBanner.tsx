"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, X } from "lucide-react";
import { useState, useEffect } from "react";
import { useUnreadCounts } from "@/lib/useUnreadCounts";

/**
 * Top-of-page banner that appears when the user has unread in-app
 * notifications. Click it to open the inbox. Dismiss with X; dismissal
 * persists until a new notification arrives (tracked by unread count).
 *
 * Hides itself on the notifications page itself to avoid redundancy.
 */
export default function UnreadBanner({ variant = "student" }: { variant?: "student" | "app" }) {
  const pathname = usePathname();
  const unread = useUnreadCounts();
  const count = unread.notifications || 0;
  const [dismissedAt, setDismissedAt] = useState<number>(0);

  useEffect(() => {
    const saved = localStorage.getItem("matflow-unread-banner-dismissed");
    if (saved) setDismissedAt(Number(saved) || 0);
  }, []);

  // Bump the dismissed threshold when count changes upward — ensures a new
  // notification re-opens the banner even if the user previously dismissed.
  const bannerKey = `${count}`;
  const isDismissed = dismissedAt === count && count > 0;

  if (count === 0) return null;
  if (pathname?.endsWith("/notifications")) return null;
  if (isDismissed) return null;

  const href = variant === "student" ? "/student/notifications" : "/app/notifications";

  function dismiss(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    localStorage.setItem("matflow-unread-banner-dismissed", bannerKey);
    setDismissedAt(count);
  }

  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 bg-[#dc2626] text-white px-4 py-2.5 text-sm font-medium hover:bg-[#b91c1c] transition shrink-0"
    >
      <span className="inline-flex items-center gap-2 min-w-0">
        <Bell className="h-4 w-4 shrink-0" />
        <span className="truncate">
          You have {count} unread notification{count === 1 ? "" : "s"}
        </span>
      </span>
      <span className="flex items-center gap-3 shrink-0">
        <span className="text-white/90 text-xs font-bold underline">View</span>
        <button
          onClick={dismiss}
          className="opacity-80 hover:opacity-100 transition"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </span>
    </Link>
  );
}
