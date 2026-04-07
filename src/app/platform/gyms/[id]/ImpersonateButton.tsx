"use client";

import { useState } from "react";

export default function ImpersonateButton({ gymId, ownerEmail }: { gymId: string; ownerEmail: string }) {
  const [loading, setLoading] = useState(false);

  async function impersonate() {
    if (!confirm(`Sign in as ${ownerEmail}? This will replace your current session.`)) return;
    setLoading(true);
    const res = await fetch(`/api/platform/impersonate/${gymId}`, { method: "POST" });
    if (res.ok) {
      window.location.href = "/app";
    } else {
      alert("Failed to impersonate");
      setLoading(false);
    }
  }

  return (
    <button
      onClick={impersonate}
      disabled={loading}
      className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition disabled:opacity-50"
    >
      {loading ? "Signing in..." : "Impersonate Owner"}
    </button>
  );
}
