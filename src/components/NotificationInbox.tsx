"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, Check, CheckCheck, Inbox, Megaphone, UserPlus, Award, FileSignature, CheckCircle2, XCircle, Sparkles } from "lucide-react";

interface NotificationRow {
  id: string;
  kind: string;
  title: string;
  body: string;
  url: string | null;
  iconUrl: string | null;
  readAt: string | null;
  createdAt: string;
  gymId: string | null;
}

const KIND_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  announcement: Megaphone,
  join_request: UserPlus,
  join_approved: CheckCircle2,
  join_rejected: XCircle,
  belt_promotion: Award,
  waiver_required: FileSignature,
  test: Sparkles,
};

const KIND_COLOR: Record<string, string> = {
  announcement: "bg-blue-500/10 text-blue-400",
  join_request: "bg-orange-500/10 text-orange-400",
  join_approved: "bg-emerald-500/10 text-emerald-400",
  join_rejected: "bg-red-500/10 text-red-400",
  belt_promotion: "bg-amber-500/10 text-amber-400",
  waiver_required: "bg-purple-500/10 text-purple-400",
  test: "bg-[#c4b5a0]/10 text-[#c4b5a0]",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function NotificationInbox() {
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  async function load() {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnread(data.unread || 0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function markRead(id: string) {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id && !n.readAt ? { ...n, readAt: new Date().toISOString() } : n))
    );
    setUnread((u) => Math.max(0, u - 1));
    await fetch(`/api/notifications/${id}/read`, { method: "POST" });
  }

  async function markAll() {
    setMarkingAll(true);
    const now = new Date().toISOString();
    setNotifications((prev) => prev.map((n) => (n.readAt ? n : { ...n, readAt: now })));
    setUnread(0);
    await fetch("/api/notifications/read-all", { method: "POST" });
    setMarkingAll(false);
  }

  if (loading) {
    return (
      <div className="text-gray-500 text-sm py-10 text-center">Loading notifications...</div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-white">Notifications</h1>
          {unread > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {unread} unread
            </span>
          )}
        </div>
        {unread > 0 && (
          <button
            onClick={markAll}
            disabled={markingAll}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition disabled:opacity-50"
          >
            <CheckCheck className="h-4 w-4" />
            Mark all read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-12 text-center">
          <Inbox className="h-10 w-10 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">
            No notifications yet. Announcements, join requests, and belt promotions will show up here.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => {
            const Icon = KIND_ICON[n.kind] || Bell;
            const colorClass = KIND_COLOR[n.kind] || "bg-white/5 text-gray-400";
            const isUnread = !n.readAt;
            const inner = (
              <div
                className={`group flex items-start gap-3 p-4 rounded-xl border transition ${
                  isUnread
                    ? "bg-[#0e0e0e] border-white/15 hover:border-white/30"
                    : "bg-[#0a0a0a] border-white/5 hover:border-white/15"
                }`}
              >
                <div
                  className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${colorClass}`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-semibold truncate ${isUnread ? "text-white" : "text-gray-300"}`}>
                      {n.title}
                    </p>
                    {isUnread && <span className="h-2 w-2 rounded-full bg-[#c4b5a0] shrink-0" />}
                  </div>
                  <p className="text-sm text-gray-400 mt-0.5 line-clamp-2">{n.body}</p>
                  <p className="text-xs text-gray-600 mt-1">{timeAgo(n.createdAt)}</p>
                </div>
                {isUnread && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      markRead(n.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 transition text-gray-500 hover:text-white shrink-0"
                    title="Mark as read"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
            return n.url ? (
              <Link
                key={n.id}
                href={n.url}
                onClick={() => isUnread && markRead(n.id)}
                className="block"
              >
                {inner}
              </Link>
            ) : (
              <div key={n.id} onClick={() => isUnread && markRead(n.id)}>
                {inner}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
