"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RequestJoinForm({ gymId, gymName }: { gymId: string; gymName: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/student/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gymId, message }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to submit");
      setLoading(false);
      return;
    }

    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={3}
        placeholder={`Optional: introduce yourself to ${gymName} (e.g. "I train Tue and Thu evenings")`}
        className="w-full px-4 py-3 bg-black border border-white/10 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-[#dc2626]"
      />
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-[#dc2626] hover:bg-[#b91c1c] text-white font-bold py-3 rounded-lg transition disabled:opacity-50"
      >
        {loading ? "Sending..." : `Request to Join ${gymName}`}
      </button>
    </form>
  );
}
