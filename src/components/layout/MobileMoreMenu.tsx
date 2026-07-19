"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { NAV_ITEMS, NAV_GROUP_ORDER } from "@/lib/nav-items";
import { cn } from "@/lib/utils";
import { X, Home } from "lucide-react";
import {
  Activity, BarChart3, Target, Users, Calendar, CheckSquare, Video,
  Package, ShoppingBag, ClipboardList, Megaphone, FileText,
  CalendarDays, Trophy, Award, Bell, UserPlus, GraduationCap, UserCheck,
  FileSignature, UserCircle, Settings, CreditCard, LayoutDashboard,
} from "lucide-react";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Activity, BarChart3, Target, Users, Calendar, CheckSquare, Video,
  Package, ShoppingBag, ClipboardList, Megaphone, FileText,
  CalendarDays, Trophy, Award, Bell, UserPlus, GraduationCap, UserCheck,
  FileSignature, UserCircle, Settings, CreditCard, LayoutDashboard, Home,
};

export function MobileMoreMenu({ onClose }: { onClose: () => void }) {
  const pathname = usePathname();
  const { role, entitlement } = useAuth();
  const isPro = entitlement?.plan === "pro";
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  const items = NAV_ITEMS.filter((item) => role && item.roles.includes(role));
  const groupedItems = NAV_GROUP_ORDER
    .map((group) => ({ group, items: items.filter((item) => item.group === group) }))
    .filter((g) => g.items.length > 0);

  // Modal a11y: trap focus, close on Escape, lock body scroll, and restore
  // focus to whatever opened the menu (the "More" tab) when it closes.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeBtnRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Menu"
      className="fixed inset-0 z-[100] flex flex-col bg-[#0a0a0a] pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-white/10 px-4">
        <span className="text-sm font-semibold text-white">Menu</span>
        <button
          ref={closeBtnRef}
          onClick={onClose}
          aria-label="Close menu"
          className="p-1 rounded-md text-gray-400 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#c4b5a0]"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-1">
        <Link
          href="/app"
          onClick={onClose}
          className={cn(
            "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors",
            pathname === "/app" ? "bg-[#c4b5a0] text-black" : "text-gray-300 hover:bg-white/5"
          )}
        >
          <Home className="h-5 w-5 shrink-0" />
          Dashboard
        </Link>

        {groupedItems.map(({ group, items: groupItems }) => (
          <div key={group} className="pt-3 first:pt-1">
            <p className="px-4 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-600">
              {group}
            </p>
            {groupItems.map((item) => {
              const Icon = ICON_MAP[item.icon] || LayoutDashboard;
              const href = `/app/${item.slug}`;
              const isActive = pathname === href || pathname.startsWith(`${href}/`);

              return (
                <Link
                  key={item.slug}
                  href={href}
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors",
                    isActive ? "bg-[#c4b5a0] text-black" : "text-gray-300 hover:bg-white/5"
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {item.pro && !isPro && (
                    <span className="shrink-0 rounded bg-[#c4b5a0]/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#c4b5a0]">
                      Pro
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
