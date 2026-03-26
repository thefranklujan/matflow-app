"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import Link from "next/link";

export default function NewGoalPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [goalType, setGoalType] = useState("monthly-attendance");
  const [targetValue, setTargetValue] = useState("");
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/members/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        goalType,
        targetValue: parseInt(targetValue, 10),
        startDate,
        endDate: endDate || undefined,
      }),
    });

    if (res.ok) {
      router.push("/members/leaderboard/goals");
      router.refresh();
    } else {
      const data = await res.json();
      setError(data.error || "Something went wrong.");
    }
    setLoading(false);
  }

  return (
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/members/leaderboard/goals"
            className="text-gray-400 hover:text-white transition text-sm"
          >
            &larr; Back to Goals
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-white uppercase tracking-wider mb-6">
          Set New Goal
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="e.g., Train 20 classes this month"
              className="w-full bg-brand-gray border border-brand-gray rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-teal"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Goal Type
            </label>
            <select
              value={goalType}
              onChange={(e) => setGoalType(e.target.value)}
              className="w-full bg-brand-gray border border-brand-gray rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-teal"
            >
              <option value="monthly-attendance">Monthly Attendance</option>
              <option value="weekly-streak">Weekly Streak</option>
              <option value="competition">Competition</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Target Value
            </label>
            <input
              type="number"
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
              required
              min={1}
              placeholder="e.g., 20"
              className="w-full bg-brand-gray border border-brand-gray rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-teal"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
              className="w-full bg-brand-gray border border-brand-gray rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-teal"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">
              End Date (optional)
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-brand-gray border border-brand-gray rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-teal"
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="bg-brand-teal text-brand-black font-bold px-4 py-2 rounded-lg hover:bg-brand-teal/90 transition text-sm disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create Goal"}
            </button>
            <button
              type="button"
              onClick={() => router.push("/members/leaderboard/goals")}
              className="text-sm text-gray-400 hover:text-white transition"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
  );
}
