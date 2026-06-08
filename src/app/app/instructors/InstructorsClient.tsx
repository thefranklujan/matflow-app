"use client";

import { useState } from "react";
import { BELT_RANKS } from "@/lib/constants";

interface Instructor {
  id: string;
  name: string;
  beltRank: string | null;
  bio: string | null;
  active: boolean;
}

function beltLabel(value: string | null) {
  if (!value) return null;
  return BELT_RANKS.find((b) => b.value === value)?.label ?? value;
}

export default function InstructorsClient({ initial }: { initial: Instructor[] }) {
  const [instructors, setInstructors] = useState<Instructor[]>(initial);
  const [name, setName] = useState("");
  const [beltRank, setBeltRank] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function create() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setCreating(true);
    setError("");
    const res = await fetch("/api/admin/instructors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed, beltRank: beltRank || null }),
    });
    setCreating(false);
    if (res.ok) {
      const created = await res.json();
      setInstructors((prev) => [...prev, created]);
      setName("");
      setBeltRank("");
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to add instructor");
    }
  }

  async function toggleActive(i: Instructor) {
    setBusyId(i.id);
    const res = await fetch(`/api/admin/instructors/${i.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !i.active }),
    });
    setBusyId(null);
    if (res.ok) {
      const updated = await res.json();
      setInstructors((prev) => prev.map((x) => (x.id === i.id ? updated : x)));
    }
  }

  async function remove(i: Instructor) {
    if (!confirm(`Remove ${i.name}? They'll be unassigned from any classes or events.`)) return;
    setBusyId(i.id);
    const res = await fetch(`/api/admin/instructors/${i.id}`, { method: "DELETE" });
    setBusyId(null);
    if (res.ok) {
      setInstructors((prev) => prev.filter((x) => x.id !== i.id));
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to remove instructor");
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Add new */}
      <div className="bg-brand-dark border border-brand-gray rounded-lg p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                create();
              }
            }}
            placeholder="Instructor name"
            className="flex-1 px-4 py-2 bg-brand-black border border-brand-gray rounded-lg text-white focus:border-brand-accent focus:outline-none transition"
          />
          <select
            value={beltRank}
            onChange={(e) => setBeltRank(e.target.value)}
            className="px-4 py-2 bg-brand-black border border-brand-gray rounded-lg text-white focus:border-brand-accent focus:outline-none transition"
          >
            <option value="">Belt (optional)</option>
            {BELT_RANKS.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={create}
            disabled={creating || !name.trim()}
            className="bg-brand-accent text-brand-black font-bold px-5 py-2 rounded-lg hover:bg-brand-accent/90 transition disabled:opacity-50 whitespace-nowrap"
          >
            {creating ? "Adding..." : "Add Instructor"}
          </button>
        </div>
      </div>

      {/* List */}
      <div className="bg-brand-dark border border-brand-gray rounded-lg divide-y divide-brand-gray/50">
        {instructors.length === 0 && (
          <div className="text-center py-8 text-gray-500 text-sm">
            No instructors yet. Add your first one above.
          </div>
        )}
        {instructors.map((i) => (
          <div key={i.id} className="flex items-center gap-3 px-4 py-3">
            <div className="flex-1 min-w-0">
              <span className={`text-sm font-medium ${i.active ? "text-white" : "text-gray-500"}`}>
                {i.name}
              </span>
              {beltLabel(i.beltRank) && (
                <span className="text-xs text-gray-500 ml-2">{beltLabel(i.beltRank)}</span>
              )}
              {!i.active && <span className="text-xs text-gray-600 ml-2">(inactive)</span>}
            </div>
            <button
              type="button"
              onClick={() => toggleActive(i)}
              disabled={busyId === i.id}
              className="text-sm text-gray-400 hover:text-brand-accent transition disabled:opacity-50"
            >
              {i.active ? "Deactivate" : "Reactivate"}
            </button>
            <button
              type="button"
              onClick={() => remove(i)}
              disabled={busyId === i.id}
              className="text-sm text-gray-400 hover:text-red-400 transition disabled:opacity-50"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
