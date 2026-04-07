"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";

const DAY_INITIALS = ["S", "M", "T", "W", "T", "F", "S"];

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function TrainingPlanClient({ initialDates }: { initialDates: string[] }) {
  const [planned, setPlanned] = useState<Set<string>>(new Set(initialDates));
  const [busy, setBusy] = useState<string | null>(null);
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const today = new Date();
  function isSameDay(a: Date, b: Date) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }
  function isPast(d: Date) {
    const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return d < t;
  }

  const cells = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const startWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const arr: (Date | null)[] = [];
    for (let i = 0; i < startWeekday; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++) arr.push(new Date(year, month, d));
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [cursor]);

  async function toggle(d: Date) {
    if (isPast(d)) return;
    const key = dateKey(d);
    if (busy === key) return;
    setBusy(key);
    const next = new Set(planned);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setPlanned(next);
    await fetch("/api/student/training-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: key }),
    });
    setBusy(null);
  }

  const monthLabel = cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const upcoming = Array.from(planned)
    .filter((k) => new Date(k) >= new Date(today.getFullYear(), today.getMonth(), today.getDate()))
    .sort()
    .slice(0, 8);
  const totalUpcoming = Array.from(planned).filter(
    (k) => new Date(k) >= new Date(today.getFullYear(), today.getMonth(), today.getDate())
  ).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Training Schedule</h1>
          <p className="text-gray-500 text-sm mt-1">Tap any day to mark when you plan to train.</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Upcoming</p>
          <p className="text-2xl font-bold text-[#dc2626]">{totalUpcoming}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-[#0a0a0a] border border-white/10 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
              className="p-1.5 rounded hover:bg-white/5 text-gray-400 hover:text-white"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <h2 className="text-lg font-bold text-white">{monthLabel}</h2>
            <button
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
              className="p-1.5 rounded hover:bg-white/5 text-gray-400 hover:text-white"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-2">
            {DAY_INITIALS.map((d, i) => (
              <div key={i} className="text-center text-xs text-gray-500 font-semibold py-1">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((d, i) => {
              if (!d) return <div key={i} />;
              const key = dateKey(d);
              const isMarked = planned.has(key);
              const isToday = isSameDay(d, today);
              const past = isPast(d);
              return (
                <button
                  key={i}
                  onClick={() => toggle(d)}
                  disabled={past}
                  className={`aspect-square rounded-lg flex flex-col items-center justify-center text-sm transition border ${
                    isMarked
                      ? "bg-[#dc2626] border-[#dc2626] text-white"
                      : isToday
                      ? "border-white/30 text-white hover:bg-white/5"
                      : past
                      ? "border-transparent text-gray-700 cursor-not-allowed"
                      : "border-white/5 text-gray-300 hover:bg-white/5 hover:border-white/15"
                  }`}
                >
                  <span className={isToday ? "font-bold" : ""}>{d.getDate()}</span>
                  {isMarked && <Check className="h-3 w-3 mt-0.5" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-6">
          <h2 className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-3">Next Up</h2>
          {upcoming.length === 0 ? (
            <p className="text-gray-600 text-sm">No training planned yet. Tap a day on the calendar.</p>
          ) : (
            <div className="space-y-2">
              {upcoming.map((k) => {
                const d = new Date(k);
                return (
                  <div key={k} className="flex items-center gap-3 bg-white/5 rounded-lg px-3 py-2">
                    <div className="h-9 w-9 rounded bg-[#dc2626]/20 text-[#dc2626] flex flex-col items-center justify-center shrink-0">
                      <span className="text-[9px] font-bold uppercase leading-none">
                        {d.toLocaleDateString("en-US", { month: "short" })}
                      </span>
                      <span className="text-sm font-bold leading-none">{d.getDate()}</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-white text-sm font-medium">
                        {d.toLocaleDateString("en-US", { weekday: "long" })}
                      </p>
                      <p className="text-gray-500 text-xs">
                        {d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
