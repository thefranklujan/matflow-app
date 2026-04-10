"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CheckSquare, Award, ClipboardCheck, UserPlus, UserCheck, UserX,
  Megaphone, FileSignature, ShoppingBag, Dumbbell, Building2, Activity as ActivityIcon,
} from "lucide-react";

interface ActivityEntry {
  id: string;
  gymId: string;
  action: string;
  actorId: string | null;
  actorName: string | null;
  targetId: string | null;
  targetName: string | null;
  meta: string | null;
  createdAt: string;
  gym?: { name: string };
}

const ACTION_CONFIG: Record<string, { verb: string; icon: typeof CheckSquare; color: string }> = {
  check_in: { verb: "checked in members", icon: CheckSquare, color: "text-emerald-400" },
  belt_promotion: { verb: "promoted", icon: Award, color: "text-yellow-400" },
  technique_verified: { verb: "verified technique for", icon: ClipboardCheck, color: "text-blue-400" },
  join_request: { verb: "requested to join", icon: UserPlus, color: "text-orange-400" },
  join_approved: { verb: "approved", icon: UserCheck, color: "text-emerald-400" },
  join_rejected: { verb: "rejected", icon: UserX, color: "text-red-400" },
  announcement_created: { verb: "posted announcement", icon: Megaphone, color: "text-purple-400" },
  waiver_signed: { verb: "signed waiver", icon: FileSignature, color: "text-teal-400" },
  order_placed: { verb: "placed an order", icon: ShoppingBag, color: "text-blue-400" },
  training_logged: { verb: "logged training session", icon: Dumbbell, color: "text-emerald-400" },
  gym_created: { verb: "registered gym", icon: Building2, color: "text-brand-accent" },
};

const ACTION_OPTIONS = [
  { value: "", label: "All Actions" },
  { value: "check_in", label: "Check-ins" },
  { value: "belt_promotion", label: "Promotions" },
  { value: "technique_verified", label: "Techniques" },
  { value: "join_request", label: "Join Requests" },
  { value: "join_approved", label: "Approvals" },
  { value: "join_rejected", label: "Rejections" },
  { value: "announcement_created", label: "Announcements" },
  { value: "waiver_signed", label: "Waivers" },
  { value: "order_placed", label: "Orders" },
  { value: "gym_created", label: "Gym Created" },
];

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function ActivityFeedClient({ apiUrl, showGym }: { apiUrl: string; showGym?: boolean }) {
  const [logs, setLogs] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchLogs = useCallback(async (cursor?: string) => {
    const params = new URLSearchParams();
    if (actionFilter) params.set("action", actionFilter);
    if (cursor) params.set("cursor", cursor);
    params.set("limit", "50");

    const res = await fetch(`${apiUrl}?${params}`);
    if (!res.ok) return;
    const data = await res.json();
    return data;
  }, [apiUrl, actionFilter]);

  useEffect(() => {
    setLoading(true);
    fetchLogs().then((data) => {
      if (data) {
        setLogs(data.logs);
        setNextCursor(data.nextCursor);
      }
      setLoading(false);
    });
  }, [fetchLogs]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    const data = await fetchLogs(nextCursor);
    if (data) {
      setLogs(prev => [...prev, ...data.logs]);
      setNextCursor(data.nextCursor);
    }
    setLoadingMore(false);
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <ActivityIcon className="h-6 w-6 text-brand-accent" />
        <h1 className="text-2xl font-bold text-white">Activity</h1>
      </div>

      <div className="mb-6">
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="bg-[#1a1a1a] border border-white/10 text-white rounded-lg px-3 py-2 text-sm"
        >
          {ACTION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-gray-500 text-sm py-8 text-center">Loading activity...</div>
      ) : logs.length === 0 ? (
        <div className="text-gray-500 text-sm py-8 text-center">No activity yet. Actions will appear here as they happen.</div>
      ) : (
        <div className="space-y-1">
          {logs.map((log) => {
            const config = ACTION_CONFIG[log.action] || { verb: log.action, icon: ActivityIcon, color: "text-gray-400" };
            const Icon = config.icon;
            let meta: Record<string, unknown> = {};
            try { if (log.meta) meta = JSON.parse(log.meta); } catch { /* */ }

            let description = `${log.actorName || "Someone"} ${config.verb}`;
            if (log.targetName) description += ` ${log.targetName}`;
            if (log.action === "belt_promotion" && meta.beltRank) {
              description += ` to ${meta.beltRank} belt`;
              if (meta.stripes) description += ` (${meta.stripes} stripe${(meta.stripes as number) > 1 ? "s" : ""})`;
            }
            if (log.action === "check_in" && meta.count) {
              description = `${log.actorName || "Admin"} checked in ${meta.count} member${(meta.count as number) !== 1 ? "s" : ""} for ${meta.classType || "class"}`;
            }
            if (log.action === "order_placed" && meta.total) {
              description += ` ($${(meta.total as number).toFixed(2)})`;
            }

            return (
              <div key={log.id} className="flex items-start gap-3 px-4 py-3 rounded-lg hover:bg-white/[0.03] transition">
                <div className={`mt-0.5 shrink-0 ${config.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-200">{description}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-500">{timeAgo(log.createdAt)}</span>
                    {showGym && log.gym?.name && (
                      <span className="text-xs text-gray-600 bg-white/5 px-1.5 py-0.5 rounded">{log.gym.name}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {nextCursor && (
        <div className="text-center mt-6">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="text-sm text-brand-accent hover:underline disabled:opacity-50"
          >
            {loadingMore ? "Loading..." : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}
