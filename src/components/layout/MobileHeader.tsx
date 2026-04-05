"use client";

import { useAuth } from "@/lib/auth-context";

export function MobileHeader() {
  const { gym, user, signOut } = useAuth();

  const initials = user
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  return (
    <header className="flex h-12 items-center justify-between border-b border-white/10 bg-[#0a0a0a] px-4 shrink-0">
      <span className="text-sm font-semibold text-white truncate">
        {gym?.name || "MatFlow"}
      </span>
      <button
        onClick={signOut}
        className="h-7 w-7 rounded-full bg-[#c4b5a0] flex items-center justify-center text-black text-[10px] font-bold"
      >
        {initials}
      </button>
    </header>
  );
}
