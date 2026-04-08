"use client";

import { useState } from "react";
import { Play } from "lucide-react";

export default function DemoModeButton() {
  const [busy, setBusy] = useState(false);

  async function enterDemo() {
    setBusy(true);
    const res = await fetch("/api/platform/demo-mode/enter", { method: "POST" });
    if (res.ok) {
      window.location.href = "/app";
    } else {
      alert("Failed to enter demo mode");
      setBusy(false);
    }
  }

  return (
    <button
      onClick={enterDemo}
      disabled={busy}
      className="inline-flex items-center gap-2 bg-[#dc2626] hover:bg-[#b91c1c] text-white font-bold px-5 py-3 rounded-lg transition disabled:opacity-50 shadow-lg shadow-red-500/20"
    >
      <Play className="h-4 w-4" fill="currentColor" />
      {busy ? "Loading..." : "Demo Mode"}
    </button>
  );
}
