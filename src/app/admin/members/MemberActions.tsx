"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function MemberActions({
  memberId,
  memberName,
  approved,
  active,
}: {
  memberId: string;
  memberName?: string;
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

  async function remove() {
    const name = memberName || "this member";
    const confirmed = confirm(
      `Remove ${name} from your gym?\n\nThis permanently deletes their attendance, belt history, and waiver signatures at this gym. Their student account is preserved.\n\nThis cannot be undone.`
    );
    if (!confirmed) return;
    setLoading(true);
    const res = await fetch(`/api/admin/members/${memberId}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Failed to remove member");
      setLoading(false);
      return;
    }
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
      <button
        disabled={loading}
        onClick={remove}
        className="text-xs px-2 py-1 rounded bg-red-600/20 text-red-400 hover:bg-red-600/40 transition disabled:opacity-50"
      >
        Remove
      </button>
    </div>
  );
}
