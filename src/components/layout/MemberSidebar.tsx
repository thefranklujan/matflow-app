"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/members", label: "Dashboard", icon: "🏠" },
  { href: "/members/videos", label: "Videos", icon: "🎥" },
  { href: "/members/schedule", label: "Schedule", icon: "📅" },
  { href: "/members/progress", label: "Progress", icon: "🥋" },
  { href: "/members/attendance", label: "Attendance", icon: "✅" },
  { href: "/members/calendar", label: "Calendar", icon: "📆" },
  { href: "/members/leaderboard", label: "Leaderboard", icon: "🏆" },
  { href: "/members/waiver", label: "Waiver", icon: "📝" },
  { href: "/members/profile", label: "Profile", icon: "👤" },
];

export default function MemberSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/sign-in");
  };
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "bg-brand-dark border-r border-brand-gray hidden lg:block fixed top-[5rem] h-[calc(100vh-5rem)] overflow-hidden transition-all duration-300 z-30",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div className={cn("p-6", collapsed && "p-3")}>
        {/* Collapse toggle */}
        <div className={cn("flex items-center mb-4", collapsed ? "justify-center" : "justify-between")}>
          {!collapsed && (
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
              Member Portal
            </h2>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-gray-400 hover:text-brand-teal transition p-1 rounded hover:bg-brand-gray/50"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7M19 19l-7-7 7-7" />
              </svg>
            )}
          </button>
        </div>

        <nav className="space-y-1">
          {links.map((link) => {
            const isActive =
              link.href === "/members"
                ? pathname === "/members"
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                title={collapsed ? link.label : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg text-sm transition",
                  collapsed ? "justify-center px-2 py-2" : "px-3 py-2",
                  isActive
                    ? "bg-brand-teal/10 text-brand-teal border border-brand-teal/30"
                    : "text-gray-300 hover:text-white hover:bg-brand-gray/50"
                )}
              >
                <span>{link.icon}</span>
                {!collapsed && link.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-8 pt-4 border-t border-brand-gray space-y-2">
          <Link
            href="/"
            title={collapsed ? "Back to Home" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-brand-gray/50 transition",
              collapsed ? "justify-center px-2 py-2" : "px-3 py-2"
            )}
          >
            <span>🏪</span>
            {!collapsed && "Back to Home"}
          </Link>
          <button
            onClick={() => signOut()}
            title={collapsed ? "Sign Out" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg text-sm text-gray-400 hover:text-red-400 hover:bg-brand-gray/50 transition w-full",
              collapsed ? "justify-center px-2 py-2" : "px-3 py-2"
            )}
          >
            <span>🚪</span>
            {!collapsed && "Sign Out"}
          </button>
        </div>
      </div>
    </aside>
  );
}
