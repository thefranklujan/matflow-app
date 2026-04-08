"use client";

import { useState } from "react";
import { Eye } from "lucide-react";

export default function ViewingStudentBanner({ studentName }: { studentName: string }) {
  const [busy, setBusy] = useState(false);

  async function exit() {
    if (!confirm(`Exit "Viewing as ${studentName}" and return to the Platform Dashboard?`)) return;
    setBusy(true);
    const res = await fetch("/api/platform/impersonate-student/exit", { method: "POST" });
    if (res.ok) {
      window.location.href = "/platform/students";
    } else {
      alert("Failed to exit");
      setBusy(false);
    }
  }

  return (
    <div className="bg-orange-500 text-black px-6 py-2 flex items-center justify-between text-sm font-semibold shrink-0">
      <span className="inline-flex items-center gap-2">
        <Eye className="h-4 w-4" />
        Viewing as <strong>{studentName}</strong>
      </span>
      <button
        onClick={exit}
        disabled={busy}
        className="bg-black text-orange-300 px-3 py-1 rounded font-bold hover:bg-gray-900 transition disabled:opacity-50"
      >
        {busy ? "Exiting..." : `Exit Viewing as ${studentName}`}
      </button>
    </div>
  );
}
