"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { NAV_ITEMS } from "@/lib/nav-items";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useUnreadCounts } from "@/lib/useUnreadCounts";
import {
  Activity, BarChart3, Target, Users, Calendar, CheckSquare, Video,
  Package, ShoppingBag, ClipboardList, Megaphone, FileText,
  CalendarDays, Trophy, TrendingUp, CalendarCheck, Award,
  FileSignature, UserCircle, Settings, CreditCard, ChevronLeft,
  ChevronRight, LayoutDashboard, Home, UserPlus, Database, ShieldCheck,
} from "lucide-react";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Activity, BarChart3, Target, Users, Calendar, CheckSquare, Video,
  Package, ShoppingBag, ClipboardList, Megaphone, FileText,
  CalendarDays, Trophy, TrendingUp, CalendarCheck, Award,
  FileSignature, UserCircle, Settings, CreditCard, LayoutDashboard, Home, UserPlus, Database, ShieldCheck,
};

export function Sidebar() {
  const pathname = usePathname();
  const { role, gym } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const unread = useUnreadCounts();

  useEffect(() => {
    try {
      const saved = localStorage.getItem("matflow-sidebar-collapsed");
      if (saved === "true") setCollapsed(true);
    } catch {}
  }, []);

  function toggleCollapse() {
    const next = !collapsed;
    setCollapsed(next);
    try { localStorage.setItem("matflow-sidebar-collapsed", String(next)); } catch {}
  }

  const mainItems = NAV_ITEMS.filter(
    (item) => item.section !== "bottom" && role && item.roles.includes(role)
  );
  const bottomItems = NAV_ITEMS.filter(
    (item) => item.section === "bottom" && role && item.roles.includes(role)
  );

  return (
    <aside
      className={cn(
        "flex h-screen flex-col border-r border-white/10 bg-[#0a0a0a] transition-all duration-200",
        collapsed ? "w-[60px]" : "w-[240px]"
      )}
    >
      {/* Header: Gym name + collapse toggle */}
      <div className="flex items-center justify-between px-3 py-4 border-b border-white/5">
        {!collapsed && (
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold text-white truncate leading-tight">
              {gym?.name || "MatFlow"}
            </span>
            <span className="text-[10px] text-gray-500 font-medium tracking-wider uppercase leading-tight">
              MatFlow
            </span>
          </div>
        )}
        <button
          onClick={toggleCollapse}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-500 hover:bg-white/5 hover:text-gray-300 transition"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* Dashboard link */}
      <div className="px-2 pt-2">
        <Link
          href="/app"
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            pathname === "/app"
              ? "bg-[#c4b5a0] text-black"
              : "text-gray-400 hover:bg-white/5 hover:text-white",
            collapsed && "justify-center px-0"
          )}
          title={collapsed ? "Dashboard" : undefined}
        >
          <Home className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Dashboard</span>}
        </Link>
      </div>

      {/* Main navigation */}
      <nav className="flex-1 space-y-0.5 px-2 py-2 overflow-y-auto">
        {mainItems.map((item) => {
          const Icon = ICON_MAP[item.icon] || LayoutDashboard;
          const href = `/app/${item.slug}`;
          const isActive = pathname === href || pathname.startsWith(`${href}/`);
          const badge = unread[item.slug] || 0;

          return (
            <Link
              key={item.slug}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-[#c4b5a0] text-black"
                  : "text-gray-400 hover:bg-white/5 hover:text-white",
                collapsed && "justify-center px-0"
              )}
              title={collapsed ? `${item.label}${badge > 0 ? ` (${badge})` : ""}` : undefined}
            >
              <div className="relative shrink-0">
                <Icon className="h-4 w-4" />
                {badge > 0 && collapsed && (
                  <span className="absolute -top-1.5 -right-1.5 h-4 min-w-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
                    {badge > 9 ? "9+" : badge}
                  </span>
                )}
              </div>
              {!collapsed && (
                <>
                  <span className="flex-1">{item.label}</span>
                  {badge > 0 && (
                    <span
                      className={cn(
                        "shrink-0 h-5 min-w-5 px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center leading-none",
                        isActive
                          ? "bg-black text-white"
                          : "bg-red-500 text-white"
                      )}
                    >
                      {badge > 99 ? "99+" : badge}
                    </span>
                  )}
                </>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      {bottomItems.length > 0 && (
        <div className="border-t border-white/5 px-2 py-2 space-y-0.5">
          {bottomItems.map((item) => {
            const Icon = ICON_MAP[item.icon] || Settings;
            const href = `/app/${item.slug}`;
            const isActive = pathname === href || pathname.startsWith(`${href}/`);

            return (
              <Link
                key={item.slug}
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-[#c4b5a0] text-black"
                    : "text-gray-400 hover:bg-white/5 hover:text-white",
                  collapsed && "justify-center px-0"
                )}
                title={collapsed ? item.label : undefined}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </div>
      )}
    </aside>
  );
}
