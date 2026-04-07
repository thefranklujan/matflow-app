"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";

interface JoinRequest {
  id: string;
  status: string;
  message: string | null;
  createdAt: string;
  student: { firstName: string; lastName: string; email: string; phone: string | null };
}

export default function RequestsClient({ requests }: { requests: JoinRequest[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [loading, setLoading] = useState<string | null>(null);

  const filtered = filter === "all" ? requests : requests.filter((r) => r.status === filter);
  const counts = {
    pending: requests.filter((r) => r.status === "pending").length,
    approved: requests.filter((r) => r.status === "approved").length,
    rejected: requests.filter((r) => r.status === "rejected").length,
  };

  async function decide(id: string, action: "approve" | "reject") {
    setLoading(id);
    const res = await fetch(`/api/admin/requests/${id}/${action}`, { method: "POST" });
    if (res.ok) router.refresh();
    setLoading(null);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-2">Join Requests</h1>
      <p className="text-gray-500 mb-6">Students requesting to join your gym.</p>

      <div className="flex gap-2 mb-6 flex-wrap">
        {(["pending", "approved", "rejected", "all"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition ${
              filter === s ? "bg-brand-accent text-brand-black" : "bg-brand-dark text-gray-400 hover:text-white"
            }`}
          >
            {s} {s !== "all" && `(${counts[s as keyof typeof counts]})`}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-brand-dark border border-brand-gray rounded-lg p-10 text-center text-gray-500">
          No {filter !== "all" ? filter : ""} requests
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <div key={r.id} className="bg-brand-dark border border-brand-gray rounded-lg p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="text-white font-semibold">{r.student.firstName} {r.student.lastName}</p>
                  <p className="text-gray-400 text-sm">{r.student.email}</p>
                  {r.student.phone && <p className="text-gray-500 text-xs">{r.student.phone}</p>}
                  {r.message && (
                    <div className="mt-3 bg-black/20 border-l-2 border-brand-accent/50 px-3 py-2 rounded">
                      <p className="text-gray-300 text-sm italic">&ldquo;{r.message}&rdquo;</p>
                    </div>
                  )}
                  <p className="text-gray-600 text-xs mt-2">Submitted {new Date(r.createdAt).toLocaleDateString()}</p>
                </div>
                {r.status === "pending" ? (
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => decide(r.id, "approve")}
                      disabled={loading === r.id}
                      className="flex items-center gap-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 font-medium px-4 py-2 rounded-lg text-sm transition disabled:opacity-50"
                    >
                      <Check className="h-4 w-4" /> Approve
                    </button>
                    <button
                      onClick={() => decide(r.id, "reject")}
                      disabled={loading === r.id}
                      className="flex items-center gap-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 font-medium px-4 py-2 rounded-lg text-sm transition disabled:opacity-50"
                    >
                      <X className="h-4 w-4" /> Reject
                    </button>
                  </div>
                ) : (
                  <span className={`text-xs font-bold px-3 py-1.5 rounded shrink-0 ${
                    r.status === "approved" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                  }`}>
                    {r.status}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
