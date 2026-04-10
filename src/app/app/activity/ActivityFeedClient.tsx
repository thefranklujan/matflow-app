"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  CheckSquare, Award, ClipboardCheck, UserPlus, UserCheck, UserX,
  Megaphone, FileSignature, ShoppingBag, Dumbbell, Building2,
  Activity as ActivityIcon, Users, GraduationCap,
  Filter, ArrowUpDown, Layers, ChevronDown, X,
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

const ACTION_CONFIG: Record<string, { verb: string; label: string; icon: typeof CheckSquare; color: string; bg: string }> = {
  check_in:              { verb: "checked in members",       label: "Check-ins",       icon: CheckSquare,    color: "text-emerald-400", bg: "bg-emerald-400/10" },
  belt_promotion:        { verb: "promoted",                 label: "Promotions",      icon: Award,          color: "text-yellow-400",  bg: "bg-yellow-400/10" },
  technique_verified:    { verb: "verified technique for",   label: "Techniques",      icon: ClipboardCheck, color: "text-blue-400",    bg: "bg-blue-400/10" },
  join_request:          { verb: "requested to join",        label: "Join Requests",   icon: UserPlus,       color: "text-orange-400",  bg: "bg-orange-400/10" },
  join_approved:         { verb: "approved",                 label: "Approvals",       icon: UserCheck,       color: "text-emerald-400", bg: "bg-emerald-400/10" },
  join_rejected:         { verb: "rejected",                 label: "Rejections",      icon: UserX,          color: "text-red-400",     bg: "bg-red-400/10" },
  announcement_created:  { verb: "posted announcement",      label: "Announcements",   icon: Megaphone,      color: "text-purple-400",  bg: "bg-purple-400/10" },
  waiver_signed:         { verb: "signed waiver",            label: "Waivers",         icon: FileSignature,  color: "text-teal-400",    bg: "bg-teal-400/10" },
  order_placed:          { verb: "placed an order",          label: "Orders",          icon: ShoppingBag,    color: "text-blue-400",    bg: "bg-blue-400/10" },
  training_logged:       { verb: "logged training session",  label: "Training",        icon: Dumbbell,       color: "text-emerald-400", bg: "bg-emerald-400/10" },
  gym_created:           { verb: "registered gym",           label: "Gym Sign-ups",    icon: Building2,      color: "text-brand-accent", bg: "bg-brand-accent/10" },
  member_added:          { verb: "joined",                   label: "Member Sign-ups", icon: Users,          color: "text-sky-400",     bg: "bg-sky-400/10" },
  student_signup:        { verb: "signed up as student",     label: "Student Sign-ups", icon: GraduationCap, color: "text-indigo-400",  bg: "bg-indigo-400/10" },
};

type SortOrder = "newest" | "oldest";
type GroupBy = "none" | "date" | "action" | "gym";

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

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

function dateKey(dateStr: string): string {
  return new Date(dateStr).toDateString();
}

function buildDescription(log: ActivityEntry, config: typeof ACTION_CONFIG[string]): string {
  let meta: Record<string, unknown> = {};
  try { if (log.meta) meta = JSON.parse(log.meta); } catch { /* */ }

  if (log.action === "check_in" && meta.count) {
    return `${log.actorName || "Admin"} checked in ${meta.count} member${(meta.count as number) !== 1 ? "s" : ""} for ${meta.classType || "class"}`;
  }
  if (log.action === "member_added") {
    return `${log.targetName || "New member"} joined the gym`;
  }
  if (log.action === "student_signup") {
    return `${log.actorName || "New student"} signed up on the platform`;
  }

  let desc = `${log.actorName || "Someone"} ${config.verb}`;
  if (log.targetName) desc += ` ${log.targetName}`;
  if (log.action === "belt_promotion" && meta.beltRank) {
    desc += ` to ${meta.beltRank} belt`;
    if (meta.stripes) desc += ` (${meta.stripes} stripe${(meta.stripes as number) > 1 ? "s" : ""})`;
  }
  if (log.action === "order_placed" && meta.total) {
    desc += ` ($${(meta.total as number).toFixed(2)})`;
  }
  return desc;
}

function DropdownMenu({ label, icon: Icon, children, active }: {
  label: string;
  icon: typeof Filter;
  children: React.ReactNode;
  active?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${
          active
            ? "bg-brand-accent/15 text-brand-accent border border-brand-accent/30"
            : "bg-[#1a1a1a] text-gray-400 border border-white/10 hover:text-white hover:border-white/20"
        }`}
      >
        <Icon className="h-3.5 w-3.5" />
        {label}
        <ChevronDown className={`h-3 w-3 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-20 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-xl py-1 min-w-[180px]">
            {children}
          </div>
        </>
      )}
    </div>
  );
}

function MenuItem({ label, active, onClick }: { label: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 text-sm transition ${
        active ? "text-brand-accent bg-brand-accent/10" : "text-gray-300 hover:bg-white/5 hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}

function ActivityRow({ log, showGym }: { log: ActivityEntry; showGym?: boolean }) {
  const config = ACTION_CONFIG[log.action] || { verb: log.action, label: log.action, icon: ActivityIcon, color: "text-gray-400", bg: "bg-gray-400/10" };
  const Icon = config.icon;
  const description = buildDescription(log, config);

  return (
    <div className="flex items-start gap-3 px-4 py-3 rounded-lg hover:bg-white/[0.03] transition">
      <div className={`mt-0.5 shrink-0 p-1.5 rounded-md ${config.bg}`}>
        <Icon className={`h-3.5 w-3.5 ${config.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-200">{description}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-gray-500">{timeAgo(log.createdAt)}</span>
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${config.bg} ${config.color}`}>
            {config.label}
          </span>
          {showGym && log.gym?.name && (
            <span className="text-xs text-gray-600 bg-white/5 px-1.5 py-0.5 rounded">{log.gym.name}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function GroupHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center gap-3 px-4 pt-5 pb-2">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</h3>
      <span className="text-[10px] text-gray-600 bg-white/5 px-1.5 py-0.5 rounded-full">{count}</span>
      <div className="flex-1 h-px bg-white/5" />
    </div>
  );
}

export default function ActivityFeedClient({ apiUrl, showGym }: { apiUrl: string; showGym?: boolean }) {
  const [logs, setLogs] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [groupBy, setGroupBy] = useState<GroupBy>("date");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchLogs = useCallback(async (cursor?: string) => {
    const params = new URLSearchParams();
    if (actionFilter) params.set("action", actionFilter);
    if (cursor) params.set("cursor", cursor);
    params.set("limit", "100");

    const res = await fetch(`${apiUrl}?${params}`);
    if (!res.ok) return;
    return await res.json();
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

  const sortedLogs = useMemo(() => {
    const sorted = [...logs];
    sorted.sort((a, b) => {
      const diff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return sortOrder === "newest" ? diff : -diff;
    });
    return sorted;
  }, [logs, sortOrder]);

  const grouped = useMemo(() => {
    if (groupBy === "none") return [{ key: "all", label: "All Activity", items: sortedLogs }];

    const groups: Record<string, { label: string; items: ActivityEntry[] }> = {};

    for (const log of sortedLogs) {
      let key: string;
      let label: string;

      if (groupBy === "date") {
        key = dateKey(log.createdAt);
        label = formatDate(log.createdAt);
      } else if (groupBy === "action") {
        key = log.action;
        label = ACTION_CONFIG[log.action]?.label || log.action;
      } else {
        key = log.gym?.name || log.gymId;
        label = log.gym?.name || "Unknown Gym";
      }

      if (!groups[key]) groups[key] = { label, items: [] };
      groups[key].items.push(log);
    }

    return Object.entries(groups).map(([key, val]) => ({ key, label: val.label, items: val.items }));
  }, [sortedLogs, groupBy]);

  const activeFilterLabel = actionFilter ? (ACTION_CONFIG[actionFilter]?.label || actionFilter) : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <ActivityIcon className="h-6 w-6 text-brand-accent" />
          <h1 className="text-2xl font-bold text-white">Activity</h1>
          {!loading && (
            <span className="text-xs text-gray-500 bg-white/5 px-2 py-1 rounded-full">{logs.length} events</span>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <DropdownMenu label={activeFilterLabel || "Filter"} icon={Filter} active={!!actionFilter}>
          <MenuItem label="All Actions" active={!actionFilter} onClick={() => setActionFilter("")} />
          <div className="h-px bg-white/5 my-1" />
          {Object.entries(ACTION_CONFIG).map(([key, cfg]) => (
            <MenuItem key={key} label={cfg.label} active={actionFilter === key} onClick={() => setActionFilter(key)} />
          ))}
        </DropdownMenu>

        <DropdownMenu label={sortOrder === "newest" ? "Newest First" : "Oldest First"} icon={ArrowUpDown}>
          <MenuItem label="Newest First" active={sortOrder === "newest"} onClick={() => setSortOrder("newest")} />
          <MenuItem label="Oldest First" active={sortOrder === "oldest"} onClick={() => setSortOrder("oldest")} />
        </DropdownMenu>

        <DropdownMenu
          label={groupBy === "none" ? "Group" : `By ${groupBy.charAt(0).toUpperCase() + groupBy.slice(1)}`}
          icon={Layers}
          active={groupBy !== "none"}
        >
          <MenuItem label="No Grouping" active={groupBy === "none"} onClick={() => setGroupBy("none")} />
          <MenuItem label="By Date" active={groupBy === "date"} onClick={() => setGroupBy("date")} />
          <MenuItem label="By Action Type" active={groupBy === "action"} onClick={() => setGroupBy("action")} />
          {showGym && <MenuItem label="By Gym" active={groupBy === "gym"} onClick={() => setGroupBy("gym")} />}
        </DropdownMenu>

        {(actionFilter || groupBy !== "date" || sortOrder !== "newest") && (
          <button
            onClick={() => { setActionFilter(""); setSortOrder("newest"); setGroupBy("date"); }}
            className="flex items-center gap-1 px-2 py-2 text-xs text-gray-500 hover:text-white transition"
          >
            <X className="h-3 w-3" />
            Reset
          </button>
        )}
      </div>

      {/* Feed */}
      {loading ? (
        <div className="text-gray-500 text-sm py-12 text-center">Loading activity...</div>
      ) : sortedLogs.length === 0 ? (
        <div className="text-gray-500 text-sm py-12 text-center">
          {actionFilter ? "No activity matches this filter." : "No activity yet. Actions will appear here as they happen."}
        </div>
      ) : (
        <div>
          {grouped.map((group) => (
            <div key={group.key}>
              {groupBy !== "none" && (
                <GroupHeader label={group.label} count={group.items.length} />
              )}
              <div className="space-y-0.5">
                {group.items.map((log) => (
                  <ActivityRow key={log.id} log={log} showGym={showGym} />
                ))}
              </div>
            </div>
          ))}
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
