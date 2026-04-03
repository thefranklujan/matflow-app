"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  source: string;
  status: string;
  notes: string | null;
  createdAt: string;
}

const STATUSES = ["new", "contacted", "trial", "enrolled", "lost"];
const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-500/20 text-blue-400",
  contacted: "bg-yellow-500/20 text-yellow-400",
  trial: "bg-purple-500/20 text-purple-400",
  enrolled: "bg-green-500/20 text-green-400",
  lost: "bg-red-500/20 text-red-400",
};

export default function LeadsClient({ leads: initialLeads }: { leads: Lead[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState("all");

  const filtered = filter === "all" ? initialLeads : initialLeads.filter((l) => l.status === filter);

  async function updateStatus(id: string, status: string) {
    await fetch(`/api/admin/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    router.refresh();
  }

  async function deleteLead(id: string) {
    if (!confirm("Delete this lead?")) return;
    await fetch(`/api/admin/leads/${id}`, { method: "DELETE" });
    router.refresh();
  }

  const counts = STATUSES.reduce((acc, s) => {
    acc[s] = initialLeads.filter((l) => l.status === s).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Lead Pipeline</h1>

      <div className="flex gap-2 mb-6 flex-wrap">
        <button
          onClick={() => setFilter("all")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            filter === "all" ? "bg-brand-teal text-brand-black" : "bg-brand-dark text-gray-400 hover:text-white"
          }`}
        >
          All ({initialLeads.length})
        </button>
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition ${
              filter === s ? "bg-brand-teal text-brand-black" : "bg-brand-dark text-gray-400 hover:text-white"
            }`}
          >
            {s} ({counts[s]})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-gray-500">No leads yet. Leads from your website demo form will appear here.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((lead) => (
            <div key={lead.id} className="bg-brand-dark border border-brand-gray rounded-lg p-4 flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-white font-medium">{lead.firstName} {lead.lastName}</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${STATUS_COLORS[lead.status] || ""}`}>
                    {lead.status}
                  </span>
                  <span className="text-gray-600 text-xs">{lead.source}</span>
                </div>
                <div className="text-gray-400 text-sm">
                  {lead.email} {lead.phone && `| ${lead.phone}`}
                </div>
                <div className="text-gray-600 text-xs mt-1">
                  {new Date(lead.createdAt).toLocaleDateString()}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={lead.status}
                  onChange={(e) => updateStatus(lead.id, e.target.value)}
                  className="bg-brand-black border border-brand-gray rounded px-2 py-1 text-sm text-gray-300"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <button onClick={() => deleteLead(lead.id)} className="text-red-400 hover:text-red-300 text-sm">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
