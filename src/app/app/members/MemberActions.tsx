"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function MemberActions({
  memberId,
  approved,
  active,
}: {
  memberId: string;
  approved: boolean;
  active: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function toggle(field: "approved" | "active", value: boolean) {
    setLoading(true);
    await fetch(`/api/admin/members/${memberId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    router.refresh();
    setLoading(false);
  }

  return (
    <div className="flex items-center gap-1">
      {!approved && (
        <button
          disabled={loading}
          onClick={() => toggle("approved", true)}
          className="text-xs px-2 py-1 rounded bg-green-600/20 text-green-400 hover:bg-green-600/40 transition disabled:opacity-50"
        >
          Approve
        </button>
      )}
      <button
        disabled={loading}
        onClick={() => toggle("active", !active)}
        className={`text-xs px-2 py-1 rounded transition disabled:opacity-50 ${
          active
            ? "bg-red-600/20 text-red-400 hover:bg-red-600/40"
            : "bg-green-600/20 text-green-400 hover:bg-green-600/40"
        }`}
      >
        {active ? "Deactivate" : "Activate"}
      </button>
    </div>
  );
}
