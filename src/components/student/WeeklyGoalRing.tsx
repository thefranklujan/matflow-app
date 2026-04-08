"use client";

import { useState } from "react";
import { Check, Target, Pencil } from "lucide-react";

export default function WeeklyGoalRing({
  current,
  goal: initialGoal,
}: {
  current: number;
  goal: number;
}) {
  const [goal, setGoal] = useState(initialGoal);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const safeGoal = Math.max(1, goal);
  const pct = Math.min(1, current / safeGoal);
  const complete = current >= safeGoal;

  const size = 92;
  const stroke = 9;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference * pct;

  async function pickGoal(value: number) {
    setSaving(true);
    setGoal(value);
    try {
      await fetch("/api/student/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weeklyGoal: value }),
      });
    } catch {
      // best effort, swallow
    }
    setSaving(false);
    setEditing(false);
  }

  return (
    <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-4 flex flex-col">
      <div className="flex items-center gap-2 mb-2">
        <div className="h-8 w-8 rounded-lg bg-[#dc2626]/15 flex items-center justify-center">
          <Target className="h-4 w-4 text-[#dc2626]" />
        </div>
        <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Weekly Goal</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative" style={{ width: size, height: size }}>
          <svg width={size} height={size} className="-rotate-90">
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth={stroke}
            />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="#dc2626"
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circumference}`}
              style={{ transition: "stroke-dasharray 600ms ease" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {complete ? (
              <Check className="h-7 w-7 text-[#dc2626]" strokeWidth={3} />
            ) : (
              <>
                <p className="text-white font-black text-lg leading-none">
                  {current}/{safeGoal}
                </p>
                <p className="text-[9px] uppercase tracking-wider text-gray-500 mt-0.5">this week</p>
              </>
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          {complete ? (
            <p className="text-[#dc2626] text-xs font-bold uppercase tracking-wider">Goal Hit</p>
          ) : (
            <p className="text-gray-400 text-xs">
              {Math.max(0, safeGoal - current)} to go this week.
            </p>
          )}
          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              className="mt-2 inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-[#dc2626] transition"
            >
              <Pencil className="h-3 w-3" /> Edit Goal
            </button>
          ) : (
            <div className="mt-2 flex flex-wrap gap-1">
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <button
                  key={n}
                  disabled={saving}
                  onClick={() => pickGoal(n)}
                  className={`h-6 w-6 rounded text-[11px] font-bold transition ${
                    n === safeGoal
                      ? "bg-[#dc2626] text-white"
                      : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
