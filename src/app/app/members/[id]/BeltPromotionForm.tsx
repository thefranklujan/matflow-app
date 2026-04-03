"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BELT_RANKS } from "@/lib/constants";

export default function BeltPromotionForm({
  memberId,
  currentBelt,
  currentStripes,
}: {
  memberId: string;
  currentBelt: string;
  currentStripes: number;
}) {
  const router = useRouter();
  const [beltRank, setBeltRank] = useState(currentBelt);
  const [stripes, setStripes] = useState(currentStripes);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const res = await fetch(`/api/admin/members/${memberId}/promote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ beltRank, stripes, note }),
    });

    if (res.ok) {
      setMessage("Promotion recorded successfully!");
      setNote("");
      router.refresh();
    } else {
      const data = await res.json();
      setMessage(data.error || "Failed to promote member.");
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm text-gray-400 mb-1">Belt Rank</label>
        <select
          value={beltRank}
          onChange={(e) => setBeltRank(e.target.value)}
          className="w-full bg-brand-gray border border-brand-gray rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-teal"
        >
          {BELT_RANKS.map((b) => (
            <option key={b.value} value={b.value}>
              {b.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-1">Stripes (0-4)</label>
        <select
          value={stripes}
          onChange={(e) => setStripes(Number(e.target.value))}
          className="w-full bg-brand-gray border border-brand-gray rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-teal"
        >
          {[0, 1, 2, 3, 4].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-1">Note</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className="w-full bg-brand-gray border border-brand-gray rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-teal resize-none"
          placeholder="Optional note about the promotion..."
        />
      </div>

      {message && (
        <p className={`text-sm ${message.includes("success") ? "text-green-400" : "text-red-400"}`}>
          {message}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="bg-brand-teal text-brand-black font-bold px-4 py-2 rounded-lg hover:bg-brand-teal/90 transition text-sm disabled:opacity-50"
      >
        {loading ? "Promoting..." : "Record Promotion"}
      </button>
    </form>
  );
}
