"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

import Link from "next/link";

const placements = ["gold", "silver", "bronze", "participant"];

interface MemberOption {
  id: string;
  firstName: string;
  lastName: string;
}

export default function AdminNewCompetitionPage() {
  const router = useRouter();
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [memberId, setMemberId] = useState("");
  const [competitionName, setCompetitionName] = useState("");
  const [date, setDate] = useState("");
  const [placement, setPlacement] = useState("gold");
  const [division, setDivision] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchMembers() {
      const res = await fetch("/api/admin/members?status=approved&active=true");
      if (res.ok) {
        const data = await res.json();
        const memberList = Array.isArray(data) ? data : data.members || [];
        setMembers(memberList);
        if (memberList.length > 0) {
          setMemberId(memberList[0].id);
        }
      }
    }
    fetchMembers();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/admin/competitions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        memberId,
        competitionName,
        date,
        placement,
        division: division || null,
        notes: notes || null,
      }),
    });

    if (res.ok) {
      router.push("/admin/competitions");
      router.refresh();
    } else {
      const data = await res.json();
      setError(data.error || "Something went wrong.");
    }
    setLoading(false);
  }

  return (
      <div>
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/admin/competitions"
            className="text-gray-400 hover:text-white transition text-sm"
          >
            &larr; Back to Competitions
          </Link>
        </div>
        <h1 className="text-2xl font-bold text-white mb-6">Record Competition Result</h1>

        <form onSubmit={handleSubmit} className="max-w-2xl space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Member</label>
            <select
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
              required
              className="w-full bg-brand-gray border border-brand-gray rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-teal"
            >
              {members.length === 0 && (
                <option value="">Loading members...</option>
              )}
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.firstName} {m.lastName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Competition Name</label>
            <input
              type="text"
              value={competitionName}
              onChange={(e) => setCompetitionName(e.target.value)}
              required
              className="w-full bg-brand-gray border border-brand-gray rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-teal"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full bg-brand-gray border border-brand-gray rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-teal"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Placement</label>
              <select
                value={placement}
                onChange={(e) => setPlacement(e.target.value)}
                className="w-full bg-brand-gray border border-brand-gray rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-teal"
              >
                {placements.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Division (optional)</label>
            <input
              type="text"
              value={division}
              onChange={(e) => setDivision(e.target.value)}
              placeholder="e.g., Adult Blue Belt Middleweight"
              className="w-full bg-brand-gray border border-brand-gray rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-teal"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full bg-brand-gray border border-brand-gray rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-teal resize-none"
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={loading}
              className="bg-brand-teal text-brand-black font-bold px-4 py-2 rounded-lg hover:bg-brand-teal/90 transition text-sm disabled:opacity-50"
            >
              {loading ? "Saving..." : "Record Result"}
            </button>
            <button
              type="button"
              onClick={() => router.push("/admin/competitions")}
              className="text-sm text-gray-400 hover:text-white transition"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
  );
}
