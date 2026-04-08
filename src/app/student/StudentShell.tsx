"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { Home, Search, Inbox, User, ChevronLeft, ChevronRight, LogOut, ClipboardList, Megaphone, Users, CalendarDays, MoreHorizontal, X, Trophy, Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import ShareMatFlow from "@/components/student/ShareMatFlow";
import QuickLogFAB from "@/components/student/QuickLogFAB";

const NAV = [
  { href: "/student", label: "Home", icon: Home },
  { href: "/student/schedule", label: "Training Schedule", icon: CalendarDays },
  { href: "/student/training", label: "Training Log", icon: ClipboardList },
  { href: "/student/clock", label: "BJJ Clock", icon: Timer },
  { href: "/student/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/student/community", label: "Community", icon: Users },
  { href: "/student/gyms", label: "Find Gyms", icon: Search },
  { href: "/student/nominate", label: "Nominate Gym", icon: Megaphone },
  { href: "/student/requests", label: "My Requests", icon: Inbox },
];

// Mobile bottom tab bar: only 4 primary items. Everything else goes into "More".
const MOBILE_PRIMARY = [
  { href: "/student", label: "Home", icon: Home },
  { href: "/student/schedule", label: "Schedule", icon: CalendarDays },
  { href: "/student/training", label: "Log", icon: ClipboardList },
];
const MOBILE_MORE = [
  { href: "/student/clock", label: "BJJ Clock", icon: Timer },
  { href: "/student/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/student/community", label: "Community", icon: Users },
  { href: "/student/gyms", label: "Find Gyms", icon: Search },
  { href: "/student/nominate", label: "Nominate Gym", icon: Megaphone },
  { href: "/student/requests", label: "My Requests", icon: Inbox },
  { href: "/student/profile", label: "Profile", icon: User },
];

const BELT_BAR: Record<string, string> = {
  white: "bg-white",
  blue: "bg-blue-500",
  purple: "bg-purple-500",
  brown: "bg-amber-700",
  black: "bg-neutral-900 border border-white/30",
};

export default function StudentShell({
  name,
  beltRank = "white",
  stripes = 0,
  avatarUrl = null,
  studentId,
  homeGym = null,
  children,
}: {
  name: string;
  beltRank?: string;
  stripes?: number;
  avatarUrl?: string | null;
  studentId?: string;
  homeGym?: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("matflow-student-sidebar-collapsed");
    if (saved === "true") setCollapsed(true);
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("matflow-student-sidebar-collapsed", String(next));
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/sign-in";
  }

  const initials = name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <>
      {/* Desktop */}
      <div className="hidden md:flex h-screen overflow-hidden bg-[#080808]">
        <aside className={cn("flex h-screen flex-col border-r border-white/10 bg-[#0a0a0a] transition-all duration-200", collapsed ? "w-[60px]" : "w-[240px]")}>
          <div className="flex items-center justify-between px-3 py-4 border-b border-white/5">
            {!collapsed ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src="/logo.svg" alt="MatFlow" className="h-9 w-auto" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src="/logo-icon.svg" alt="MatFlow" className="h-7 w-7" />
            )}
            <button onClick={toggle} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-500 hover:bg-white/5 hover:text-gray-300 transition">
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          </div>

          <nav className="flex-1 space-y-0.5 px-2 py-2">
            {NAV.map((item) => {
              const Icon = item.icon;
              const isActive = item.href === "/student" ? pathname === "/student" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive ? "bg-[#dc2626] text-white" : "text-gray-400 hover:bg-white/5 hover:text-white",
                    collapsed && "justify-center px-0"
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              );
            })}
          </nav>

          {!collapsed && (
            <div className="px-2 pb-3 border-t border-white/5 pt-3">
              <ShareMatFlow studentId={studentId} variant="card" />
            </div>
          )}
        </aside>

        <div className="flex flex-1 flex-col overflow-hidden">
          <header className="flex h-14 items-center justify-end border-b border-white/10 bg-[#0a0a0a] px-6">
            <div className="relative" ref={menuRef}>
              <button onClick={() => setShowMenu(!showMenu)} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-white/5 transition">
                <span className="text-sm text-gray-200 font-medium hidden sm:inline">{name}</span>
                <span className="hidden sm:inline-flex items-stretch h-6 w-28 rounded-sm overflow-hidden border border-white/80 shadow-inner" title={`${beltRank} belt${stripes > 0 ? `, ${stripes} stripe${stripes > 1 ? "s" : ""}` : ""}`}>
                  <span className={`flex-1 ${BELT_BAR[beltRank] || BELT_BAR.white}`} />
                  <span className="w-11 bg-black flex items-center justify-center gap-[3px] px-1">
                    {Array.from({ length: stripes }).map((_, i) => (
                      <span key={i} className="inline-block h-4 w-[3px] rounded-[1px] bg-white" />
                    ))}
                  </span>
                </span>
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt={name} className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-[#dc2626] flex items-center justify-center text-white text-xs font-bold">{initials}</div>
                )}
              </button>
              {showMenu && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-[#141414] border border-white/10 rounded-lg shadow-xl z-50 py-1">
                  <Link href="/student/profile" onClick={() => setShowMenu(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 transition">
                    <User className="h-4 w-4" /> Profile
                  </Link>
                  <button onClick={signOut} className="flex items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:bg-white/5 transition w-full text-left">
                    <LogOut className="h-4 w-4" /> Sign Out
                  </button>
                </div>
              )}
            </div>
          </header>
          <main className="flex-1 overflow-y-auto bg-[#111] p-6">{children}</main>
        </div>
      </div>

      {/* Mobile */}
      <div className="md:hidden flex h-screen flex-col bg-[#080808]">
        <header className="flex h-12 items-center justify-between border-b border-white/10 bg-[#0a0a0a] px-4 shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="MatFlow" className="h-7 w-auto" />
          <button onClick={signOut} className="h-7 w-7 rounded-full bg-[#dc2626] flex items-center justify-center text-white text-[10px] font-bold">{initials}</button>
        </header>
        <main className="flex-1 overflow-y-auto bg-[#111] p-4 pb-20">{children}</main>
        <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-[#0a0a0a] pb-[env(safe-area-inset-bottom)]">
          <div className="flex h-16 items-stretch">
            {MOBILE_PRIMARY.map((item) => {
              const Icon = item.icon;
              const isActive = item.href === "/student" ? pathname === "/student" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors",
                    isActive ? "text-[#dc2626]" : "text-gray-500"
                  )}
                >
                  <Icon className={cn("h-5 w-5", isActive && "text-[#dc2626]")} />
                  {item.label}
                </Link>
              );
            })}
            <button
              onClick={() => setMoreOpen(true)}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors",
                MOBILE_MORE.some((i) => pathname.startsWith(i.href)) ? "text-[#dc2626]" : "text-gray-500"
              )}
            >
              <MoreHorizontal className="h-5 w-5" />
              More
            </button>
          </div>
        </nav>

        {moreOpen && (
          <div
            className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-end"
            onClick={() => setMoreOpen(false)}
          >
            <div
              className="w-full bg-[#0a0a0a] border-t border-white/10 rounded-t-2xl p-5 pb-[calc(env(safe-area-inset-bottom)+20px)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-white font-bold text-lg">More</h3>
                <button
                  onClick={() => setMoreOpen(false)}
                  className="h-8 w-8 rounded-full bg-white/5 flex items-center justify-center text-gray-400"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 gap-1">
                {MOBILE_MORE.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMoreOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-3 rounded-lg transition",
                        isActive ? "bg-[#dc2626]/10 text-[#dc2626]" : "text-gray-300 hover:bg-white/5"
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="font-medium">{item.label}</span>
                    </Link>
                  );
                })}
                <button
                  onClick={() => { setMoreOpen(false); signOut(); }}
                  className="flex items-center gap-3 px-3 py-3 rounded-lg text-gray-400 hover:bg-white/5 mt-2 border-t border-white/5 pt-4"
                >
                  <LogOut className="h-5 w-5" />
                  <span className="font-medium">Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <QuickLogFAB defaultGym={homeGym} />
    </>
  );
}
