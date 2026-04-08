"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";

// Shown on the student home when the user has a training plan for today
// but hasn't logged a session yet. One tap converts the plan into a logged
// session so the streak and metrics update instantly.
export default function AutoLogTodayButton({
  plannedGym,
  plannedBlock,
}: {
  plannedGym: string | null;
  plannedBlock: string;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  async function mark() {
    setSaving(true);
    try {
      const res = await fetch("/api/student/training", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: new Date().toISOString(),
          duration: 60,
          sessionType: "class",
          gym: plannedGym || null,
          notes: "Auto-logged from schedule",
        }),
      });
      if (res.ok) {
        setDone(true);
        setTimeout(() => router.refresh(), 800);
      }
    } catch {}
    setSaving(false);
  }

  if (done) {
    return (
      <div className="bg-green-500/10 border border-green-500/40 rounded-2xl p-5 flex items-center gap-4">
        <div className="h-10 w-10 rounded-full bg-green-500 flex items-center justify-center">
          <Check className="h-5 w-5 text-white" />
        </div>
        <p className="text-white font-semibold">Session logged. Streak updated.</p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-[#dc2626]/15 to-[#dc2626]/5 border border-[#dc2626]/40 rounded-2xl p-5 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-white font-bold text-base">You planned to train today.</p>
        <p className="text-gray-400 text-xs mt-0.5 truncate">
          {plannedBlock}{plannedGym ? ` · ${plannedGym}` : ""}
        </p>
      </div>
      <button
        onClick={mark}
        disabled={saving}
        className="shrink-0 bg-[#dc2626] hover:bg-[#b91c1c] disabled:opacity-50 text-white font-bold px-5 py-3 rounded-lg transition flex items-center gap-2"
      >
        <Check className="h-4 w-4" />
        {saving ? "Logging..." : "Done"}
      </button>
    </div>
  );
}
