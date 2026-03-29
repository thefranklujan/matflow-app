"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/members", label: "Dashboard", icon: "🏠" },
  { href: "/members/videos", label: "Videos", icon: "🎥" },
  { href: "/members/schedule", label: "Schedule", icon: "📅" },
  { href: "/members/progress", label: "Progress", icon: "🥋" },
  { href: "/members/attendance", label: "Attendance", icon: "✅" },
  { href: "/members/calendar", label: "Calendar", icon: "📆" },
  { href: "/members/leaderboard", label: "Leaderboard", icon: "🏆" },
  { href: "/members/profile", label: "Profile", icon: "👤" },
];

export default function MemberMobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/sign-in");
  };
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Close drawer on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      {/* Mobile top bar - only visible below lg */}
      <div className="lg:hidden sticky top-20 z-40 bg-brand-dark border-b border-brand-gray flex items-center justify-between px-4 py-3">
        <span className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
          Member Portal
        </span>
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 text-brand-teal text-sm font-semibold uppercase tracking-wider"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          Menu
        </button>
      </div>

      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[60] bg-black/60 transition-opacity duration-300 lg:hidden ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setOpen(false)}
      />

      {/* Slide-out drawer */}
      <div
        className={`fixed top-0 left-0 z-[70] h-full w-72 bg-brand-dark border-r border-brand-gray shadow-2xl transform transition-transform duration-300 ease-in-out lg:hidden ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-brand-gray">
          <span className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
            Member Portal
          </span>
          <button
            onClick={() => setOpen(false)}
            className="p-2 text-gray-400 hover:text-white transition"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Nav links */}
        <nav className="p-5 space-y-1">
          {links.map((link) => {
            const isActive =
              link.href === "/members"
                ? pathname === "/members"
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-3 rounded-lg text-sm transition",
                  isActive
                    ? "bg-brand-teal/10 text-brand-teal border border-brand-teal/30"
                    : "text-gray-300 hover:text-white hover:bg-brand-gray/50"
                )}
              >
                <span className="text-lg">{link.icon}</span>
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Bottom actions */}
        <div className="absolute bottom-0 left-0 right-0 p-5 border-t border-brand-gray space-y-2">
          <Link
            href="/"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-brand-gray/50 transition"
          >
            <span>🏪</span>
            Back to Home
          </Link>
          <button
            onClick={() => signOut()}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-red-400 hover:bg-brand-gray/50 transition w-full"
          >
            <span>🚪</span>
            Sign Out
          </button>
        </div>
      </div>
    </>
  );
}
