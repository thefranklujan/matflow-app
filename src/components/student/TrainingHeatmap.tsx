"use client";

import { useMemo, useState } from "react";

function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function colorFor(count: number) {
  if (count <= 0) return "rgba(255,255,255,0.05)";
  if (count === 1) return "rgba(220,38,38,0.35)";
  if (count === 2) return "rgba(220,38,38,0.55)";
  return "#dc2626";
}

export default function TrainingHeatmap({
  sessionDates,
}: {
  sessionDates: string[];
}) {
  const [hover, setHover] = useState<{ date: string; count: number } | null>(null);

  const { weeks, counts } = useMemo(() => {
    const counts = new Map<string, number>();
    for (const iso of sessionDates) {
      const d = new Date(iso);
      const k = dayKey(d);
      counts.set(k, (counts.get(k) || 0) + 1);
    }

    // 13 columns x 7 rows = 91 days. Anchor end on the most recent Saturday
    // so the rightmost column ends today (or next Saturday) and rows are Sun-Sat.
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(today);
    end.setDate(end.getDate() + (6 - end.getDay()));
    const start = new Date(end);
    start.setDate(end.getDate() - 90);

    const weeks: { date: Date; key: string; count: number; future: boolean }[][] = [];
    const cursor = new Date(start);
    for (let w = 0; w < 13; w++) {
      const col: { date: Date; key: string; count: number; future: boolean }[] = [];
      for (let r = 0; r < 7; r++) {
        const k = dayKey(cursor);
        col.push({
          date: new Date(cursor),
          key: k,
          count: counts.get(k) || 0,
          future: cursor > today,
        });
        cursor.setDate(cursor.getDate() + 1);
      }
      weeks.push(col);
    }
    return { weeks, counts };
  }, [sessionDates]);

  const total = Array.from(counts.values()).reduce((a, b) => a + b, 0);

  return (
    <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-5 mb-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-white font-semibold text-sm">Last 90 Days</p>
        <p className="text-gray-500 text-xs">
          {total} session{total === 1 ? "" : "s"}
        </p>
      </div>

      <div className="relative">
        <div className="flex gap-[3px]">
          {weeks.map((col, i) => (
            <div key={i} className="flex flex-col gap-[3px]">
              {col.map((cell) => (
                <div
                  key={cell.key}
                  onMouseEnter={() => setHover({ date: cell.key, count: cell.count })}
                  onMouseLeave={() => setHover(null)}
                  className="h-[14px] w-[14px] rounded-[3px] transition"
                  style={{
                    background: cell.future ? "transparent" : colorFor(cell.count),
                    border: cell.future ? "1px dashed rgba(255,255,255,0.04)" : "none",
                  }}
                  title={`${cell.key}: ${cell.count} session${cell.count === 1 ? "" : "s"}`}
                />
              ))}
            </div>
          ))}
        </div>

        {hover && (
          <div className="mt-3 text-xs text-gray-400">
            <span className="text-white font-semibold">
              {new Date(hover.date + "T00:00:00").toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </span>
            {" . "}
            {hover.count} session{hover.count === 1 ? "" : "s"}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 mt-4 text-[11px] text-gray-500">
        <span>Less</span>
        <span className="h-[12px] w-[12px] rounded-[3px]" style={{ background: "rgba(255,255,255,0.05)" }} />
        <span className="h-[12px] w-[12px] rounded-[3px]" style={{ background: "rgba(220,38,38,0.35)" }} />
        <span className="h-[12px] w-[12px] rounded-[3px]" style={{ background: "rgba(220,38,38,0.55)" }} />
        <span className="h-[12px] w-[12px] rounded-[3px]" style={{ background: "#dc2626" }} />
        <span>More</span>
      </div>
    </div>
  );
}
