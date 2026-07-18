"use client";

import Link from "next/link";
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
  const { role } = useAuth();

  const items = NAV_ITEMS.filter((item) => role && item.roles.includes(role));
  const groupedItems = NAV_GROUP_ORDER
    .map((group) => ({ group, items: items.filter((item) => item.group === group) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="fixed inset-0 z-[100] bg-[#0a0a0a]">
      <div className="flex h-12 items-center justify-between border-b border-white/10 px-4">
        <span className="text-sm font-semibold text-white">Menu</span>
        <button onClick={onClose} className="p-1 rounded-md text-gray-400 hover:text-white">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="overflow-y-auto p-4 space-y-1" style={{ maxHeight: "calc(100vh - 48px)" }}>
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
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
