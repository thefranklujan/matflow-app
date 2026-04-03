"use client";

import { useRouter, useSearchParams } from "next/navigation";

const PERIODS = [
  { label: "This Month", value: "month" },
  { label: "This Year", value: "year" },
];

export default function PeriodToggle() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const active = searchParams.get("period") || "month";

  function handleClick(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", value);
    router.push(`/members/leaderboard?${params.toString()}`);
  }

  return (
    <div className="flex gap-2 mb-6">
      {PERIODS.map((p) => {
        const isActive = active === p.value;
        return (
          <button
            key={p.value}
            onClick={() => handleClick(p.value)}
            className={
              isActive
                ? "bg-brand-teal text-brand-black font-bold rounded-lg px-4 py-2 text-sm transition"
                : "bg-brand-dark border border-brand-gray text-gray-300 rounded-lg px-4 py-2 text-sm transition hover:border-brand-teal hover:text-white"
            }
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}
