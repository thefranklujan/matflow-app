"use client";

import { useState } from "react";

export interface AcademyClassItem {
  scheduleId: string;
  dateKey: string;
  dayLabel: string;
  startTime: string;
  endTime: string;
  classType: string;
  instructor: string;
  committed: boolean;
}

/**
 * Upcoming classes with an "I'm going" toggle. Going is a plan, not
 * attendance — the label says so, and nothing here checks anyone in.
 */
export default function AcademyClassList({ gymId, items }: { gymId: string; items: AcademyClassItem[] }) {
  const [state, setState] = useState(items);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle(item: AcademyClassItem) {
    const key = `${item.scheduleId}:${item.dateKey}`;
    if (busy) return;
    setBusy(key);
    setError(null);
    try {
      const res = await fetch(`/api/student/academy/${encodeURIComponent(gymId)}/commitments`, {
        method: item.committed ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduleId: item.scheduleId, date: item.dateKey }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Could not update your plan.");
      }
      setState((prev) =>
        prev.map((p) => (p.scheduleId === item.scheduleId && p.dateKey === item.dateKey ? { ...p, committed: !p.committed } : p)),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update your plan.");
    } finally {
      setBusy(null);
    }
  }

  if (state.length === 0) {
    return <p className="text-gray-400 text-sm">No classes are scheduled in the next 7 days.</p>;
  }

  return (
    <div>
      {error && (
        <p role="alert" className="text-red-300 text-sm mb-2">
          {error}
        </p>
      )}
      <ul className="divide-y divide-white/5">
        {state.map((item) => {
          const key = `${item.scheduleId}:${item.dateKey}`;
          return (
            <li key={key} className="py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-white text-sm font-medium truncate">{item.classType}</p>
                <p className="text-gray-400 text-xs">
                  {item.dayLabel} · {item.startTime}–{item.endTime}
                  {item.instructor ? ` · ${item.instructor}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => toggle(item)}
                disabled={busy === key}
                aria-pressed={item.committed}
                aria-label={`${item.committed ? "Remove plan for" : "Plan to attend"} ${item.classType} on ${item.dayLabel} at ${item.startTime}`}
                className={`shrink-0 text-xs font-semibold px-3 py-2 rounded-lg border transition disabled:opacity-50 ${
                  item.committed
                    ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                    : "border-white/15 text-gray-300 hover:border-[#dc2626]"
                }`}
              >
                {busy === key ? "Saving…" : item.committed ? "Planning to go" : "I'm going"}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="text-gray-400 text-xs mt-2">
        &ldquo;I&apos;m going&rdquo; tells your academy you plan to attend. Attendance is recorded when you check in.
      </p>
    </div>
  );
}
