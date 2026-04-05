"use client";

import { useRouter, useSearchParams } from "next/navigation";

const TABS = [
  { label: "Overall", value: "overall" },
  { label: "Gi", value: "gi" },
  { label: "No-Gi", value: "nogi" },
  { label: "Kids", value: "kids" },
  { label: "Streaks", value: "streaks" },
  { label: "Competitions", value: "competitions" },
  { label: "Goals", value: "goals" },
];

export default function LeaderboardTabs() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const active = searchParams.get("category") || "overall";

  function handleClick(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("category", value);
    router.push(`/members/leaderboard?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-2 mb-6">
      {TABS.map((tab) => {
        const isActive = active === tab.value;
        return (
          <button
            key={tab.value}
            onClick={() => handleClick(tab.value)}
            className={
              isActive
                ? "bg-brand-accent text-brand-black font-bold rounded-lg px-4 py-2 text-sm transition"
                : "bg-brand-dark border border-brand-gray text-gray-300 rounded-lg px-4 py-2 text-sm transition hover:border-brand-accent hover:text-white"
            }
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
