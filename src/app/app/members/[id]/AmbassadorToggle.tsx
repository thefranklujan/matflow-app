"use client";

import { useState } from "react";

export default function AmbassadorToggle({
  memberId,
  initial,
}: {
  memberId: string;
  initial: boolean;
}) {
  const [isAmbassador, setIsAmbassador] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    const next = !isAmbassador;
    const res = await fetch(`/api/admin/members/${memberId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isAmbassador: next }),
    });
    if (res.ok) setIsAmbassador(next);
    setBusy(false);
  }

  return (
    <div className="bg-brand-dark border border-brand-gray rounded-lg p-6 mb-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="text-yellow-400">👑</span> Gym Ambassador
          </h2>
          <p className="text-gray-500 text-xs mt-1">
            Highlight this member as a representative of your gym.
          </p>
        </div>
        <button
          onClick={toggle}
          disabled={busy}
          className={`relative h-7 w-12 rounded-full transition disabled:opacity-50 ${
            isAmbassador ? "bg-yellow-400" : "bg-white/10"
          }`}
        >
          <span
            className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition ${
              isAmbassador ? "left-[1.375rem]" : "left-0.5"
            }`}
          />
        </button>
      </div>
    </div>
  );
}
