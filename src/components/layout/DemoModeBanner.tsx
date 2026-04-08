"use client";

import { useState } from "react";
import { Play } from "lucide-react";

export default function DemoModeBanner() {
  const [busy, setBusy] = useState(false);

  async function exit() {
    if (!confirm("Exit Demo Mode? You will be returned to the Platform Dashboard as your platform admin account.")) {
      return;
    }
    setBusy(true);
    const res = await fetch("/api/platform/demo-mode/exit", { method: "POST" });
    if (res.ok) {
      window.location.href = "/platform";
    } else {
      alert("Failed to exit demo mode");
      setBusy(false);
    }
  }

  return (
    <div className="bg-[#dc2626] text-white px-6 py-2 flex items-center justify-between text-sm font-medium shrink-0">
      <span className="inline-flex items-center gap-2">
        <Play className="h-3.5 w-3.5" fill="currentColor" />
        Demo Mode &mdash; viewing MatFlow Sample Gym as a prospect would
      </span>
      <button
        onClick={exit}
        disabled={busy}
        className="bg-black/40 hover:bg-black/60 text-white px-3 py-1 rounded font-bold transition disabled:opacity-50"
      >
        {busy ? "Exiting..." : "Exit Demo"}
      </button>
    </div>
  );
}
