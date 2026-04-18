"use client";

import { useState, useRef, useEffect } from "react";
import { LogOut, ArrowLeft } from "lucide-react";

export default function PlatformUserMenu({ name, email }: { name: string; email: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const initials = name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  async function signOut() {
    try { await (window as unknown as { __matflowClearNativeAuth?: () => Promise<void> }).__matflowClearNativeAuth?.(); } catch {}
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/sign-in";
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-white/5 transition"
      >
        <span className="text-sm text-gray-400 hidden sm:block">{name}</span>
        <div className="h-8 w-8 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs font-bold">
          {initials}
        </div>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 bg-[#141414] border border-white/10 rounded-lg shadow-xl z-50 py-1">
          <div className="px-4 py-3 border-b border-white/5">
            <p className="text-white text-sm font-medium truncate">{name}</p>
            <p className="text-gray-500 text-xs truncate">{email}</p>
            <span className="inline-block mt-1.5 bg-orange-500/20 text-orange-400 text-[10px] font-semibold px-2 py-0.5 rounded uppercase tracking-wider">
              Platform Admin
            </span>
          </div>
          <a
            href="/app"
            className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 transition w-full text-left"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to App
          </a>
          <div className="border-t border-white/5" />
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
  );
}
