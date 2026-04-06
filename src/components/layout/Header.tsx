"use client";

import { useAuth } from "@/lib/auth-context";
import { LogOut, User, LayoutGrid } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";

export function Header() {
  const { user, signOut, isAdmin, isPlatformAdmin } = useAuth();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const initials = user
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  return (
    <header className="flex h-14 items-center justify-between border-b border-white/10 bg-[#0a0a0a] px-6">
      <div />
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-white/5 transition"
        >
          <span className="text-sm text-gray-400 hidden sm:block">{user?.name}</span>
          <div className="h-8 w-8 rounded-full bg-[#c4b5a0] flex items-center justify-center text-black text-xs font-bold">
            {initials}
          </div>
        </button>

        {showMenu && (
          <div className="absolute right-0 top-full mt-1 w-52 bg-[#141414] border border-white/10 rounded-lg shadow-xl z-50 py-1">
            {isPlatformAdmin && (
              <>
                <Link
                  href="/platform"
                  onClick={() => setShowMenu(false)}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm text-orange-400 hover:bg-orange-500/10 transition"
                >
                  <LayoutGrid className="h-4 w-4" />
                  Platform Dashboard
                </Link>
                <div className="border-t border-white/5 my-1" />
              </>
            )}
            {!isAdmin && (
              <Link
                href="/app/profile"
                onClick={() => setShowMenu(false)}
                className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 transition"
              >
                <User className="h-4 w-4" />
                Profile
              </Link>
            )}
            {isAdmin && (
              <Link
                href="/app/settings"
                onClick={() => setShowMenu(false)}
                className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 transition"
              >
                <User className="h-4 w-4" />
                Settings
              </Link>
            )}
            <button
              onClick={signOut}
              className="flex items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:bg-white/5 transition w-full text-left"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
