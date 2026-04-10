"use client";

import { useState, useEffect, useCallback } from "react";
import { ShieldCheck, Check, X, Clock, Mail, Users, AlertTriangle } from "lucide-react";

interface PendingGym {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  state: string | null;
  phone: string | null;
  website: string | null;
  subscriptionStatus: string;
  createdAt: string;
  members: { firstName: string; lastName: string; email: string }[];
  _count: { members: number };
}

function ConfirmModal({ gym, action, onConfirm, onCancel }: {
  gym: PendingGym;
  action: "approve" | "reject";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const isApprove = action === "approve";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
      <div className="relative bg-[#111111] border border-white/10 rounded-xl w-full max-w-md" style={{ padding: "32px" }}>
        <div className="flex items-center justify-center" style={{ marginBottom: "20px" }}>
          <div className={`h-14 w-14 rounded-full flex items-center justify-center ${
            isApprove ? "bg-emerald-500/10" : "bg-red-500/10"
          }`}>
            {isApprove
              ? <Check className="h-7 w-7 text-emerald-400" />
              : <AlertTriangle className="h-7 w-7 text-red-400" />
            }
          </div>
        </div>
        <h3 className="text-lg font-bold text-white text-center" style={{ marginBottom: "8px" }}>
          {isApprove ? "Approve Gym?" : "Reject Gym?"}
        </h3>
        <p className="text-gray-400 text-sm text-center" style={{ marginBottom: "24px" }}>
          {isApprove
            ? <>Are you sure you want to approve <span className="text-white font-medium">{gym.name}</span>? They will get full access to MatFlow immediately.</>
            : <>Are you sure you want to reject <span className="text-white font-medium">{gym.name}</span>? This will permanently delete their account and all associated data.</>
          }
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 bg-white/5 text-gray-400 rounded-lg text-sm font-medium hover:text-white transition"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
              isApprove
                ? "bg-emerald-500 text-white hover:bg-emerald-600"
                : "bg-red-500 text-white hover:bg-red-600"
            }`}
          >
            {isApprove ? "Yes, Approve" : "Yes, Reject"}
          </button>
        </div>
      </div>
    </div>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export default function ApproveGymsClient() {
  const [gyms, setGyms] = useState<PendingGym[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState<{ gym: PendingGym; action: "approve" | "reject" } | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);

  const fetchGyms = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/approve-gyms");
      if (res.ok) {
        const data = await res.json();
        setGyms(data.gyms);
      }
    } catch (err) {
      console.error("Failed to fetch pending gyms:", err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchGyms(); }, [fetchGyms]);

  async function handleAction(gymId: string, action: "approve" | "reject") {
    setProcessing(gymId);
    setConfirm(null);
    try {
      const res = await fetch("/api/admin/approve-gyms", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gymId, action }),
      });
      if (res.ok) {
        setGyms(prev => prev.filter(g => g.id !== gymId));
      }
    } catch (err) {
      console.error("Action failed:", err);
    }
    setProcessing(null);
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3" style={{ marginBottom: "24px" }}>
        <ShieldCheck className="h-6 w-6 text-brand-accent" />
        <h1 className="text-2xl font-bold text-white">Approve Gyms</h1>
        {!loading && (
          <span className={`text-xs px-2 py-1 rounded-full ${
            gyms.length > 0
              ? "bg-orange-500/15 text-orange-400"
              : "bg-white/5 text-gray-500"
          }`}>
            {gyms.length} pending
          </span>
        )}
      </div>

      {loading ? (
        <div className="text-gray-500 text-sm py-12 text-center">Loading pending gyms...</div>
      ) : gyms.length === 0 ? (
        <div className="text-center" style={{ paddingTop: "64px", paddingBottom: "64px" }}>
          <div className="flex items-center justify-center" style={{ marginBottom: "16px" }}>
            <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <Check className="h-8 w-8 text-emerald-400" />
            </div>
          </div>
          <h3 className="text-lg font-semibold text-white" style={{ marginBottom: "4px" }}>All caught up</h3>
          <p className="text-gray-500 text-sm">No gyms waiting for approval.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {gyms.map((gym) => {
            const owner = gym.members[0];
            const isProcessing = processing === gym.id;
            return (
              <div
                key={gym.id}
                className={`bg-[#1a1a1a] border border-white/10 rounded-xl transition ${
                  isProcessing ? "opacity-50" : ""
                }`}
                style={{ padding: "24px" }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3" style={{ marginBottom: "8px" }}>
                      <div className="h-10 w-10 rounded-lg bg-[#c4b5a0]/10 flex items-center justify-center text-[#c4b5a0] text-sm font-bold shrink-0">
                        {gym.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-white font-semibold">{gym.name}</h3>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 bg-orange-500/10 text-orange-400 px-1.5 py-0.5 rounded font-medium">
                            <Clock className="h-3 w-3 inline mr-1" />
                            {timeAgo(gym.createdAt)}
                          </span>
                          {(gym.city || gym.state) && (
                            <span className="text-xs text-gray-500">
                              {gym.city}{gym.city && gym.state ? ", " : ""}{gym.state}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {owner && (
                      <div className="flex items-center gap-4" style={{ marginTop: "12px" }}>
                        <div className="flex items-center gap-2 text-sm text-gray-300">
                          <Users className="h-3.5 w-3.5 text-gray-500" />
                          {owner.firstName} {owner.lastName}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                          <Mail className="h-3.5 w-3.5 text-gray-500" />
                          {owner.email}
                        </div>
                      </div>
                    )}

                    {gym.website && (
                      <p className="text-xs text-gray-500" style={{ marginTop: "6px" }}>{gym.website}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0" style={{ marginLeft: "16px" }}>
                    <button
                      onClick={() => setConfirm({ gym, action: "reject" })}
                      disabled={isProcessing}
                      className="flex items-center gap-1.5 px-4 py-2 bg-red-500/10 text-red-400 rounded-lg text-sm font-medium hover:bg-red-500/20 disabled:opacity-30 transition"
                    >
                      <X className="h-4 w-4" /> Reject
                    </button>
                    <button
                      onClick={() => setConfirm({ gym, action: "approve" })}
                      disabled={isProcessing}
                      className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 disabled:opacity-30 transition"
                    >
                      <Check className="h-4 w-4" /> Approve
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {confirm && (
        <ConfirmModal
          gym={confirm.gym}
          action={confirm.action}
          onConfirm={() => handleAction(confirm.gym.id, confirm.action)}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
