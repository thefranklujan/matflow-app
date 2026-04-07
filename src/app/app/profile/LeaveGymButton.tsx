"use client";

import { useState } from "react";

export default function LeaveGymButton() {
  const [busy, setBusy] = useState(false);
  async function leave() {
    if (!confirm("Leave this gym? You'll be signed out and the gym will no longer appear in your account.")) return;
    setBusy(true);
    const res = await fetch("/api/student/leave-gym", { method: "POST" });
    if (res.ok) {
      window.location.href = "/sign-in";
    } else {
      alert("Failed to leave gym");
      setBusy(false);
    }
  }
  return (
    <div className="bg-brand-dark border border-red-500/20 rounded-lg p-6 mt-6">
      <h2 className="text-lg font-bold text-white mb-1">Leave Gym</h2>
      <p className="text-gray-500 text-sm mb-4">
        Remove your affiliation with this gym. Your Student account stays, and you can find a new gym
        afterwards or stay unaffiliated.
      </p>
      <button
        onClick={leave}
        disabled={busy}
        className="bg-red-500 hover:bg-red-600 text-white font-bold px-4 py-2 rounded-lg transition text-sm disabled:opacity-50"
      >
        {busy ? "Leaving..." : "Leave this gym"}
      </button>
    </div>
  );
}
