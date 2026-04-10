"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Send, Eye, MousePointerClick, AlertTriangle,
  TrendingUp, ExternalLink, X,
} from "lucide-react";

interface ReportData {
  campaign: {
    id: string;
    subject: string;
    audience: string;
    status: string;
    sentAt: string | null;
    sentCount: number;
  };
  metrics: {
    sent: number;
    opened: number;
    clicked: number;
    failed: number;
    totalClicks: number;
    openRate: number;
    clickRate: number;
    clickToOpenRate: number;
  };
  clicksByUrl: [string, number][];
  timeline: [string, { opens: number; clicks: number }][];
  recentActivity: { email: string; event: string; metadata: string | null; time: string }[];
  emailLists: {
    sent: string[];
    opened: string[];
    clicked: string[];
    bounced: string[];
  };
}

const EVENT_COLORS: Record<string, { bg: string; text: string; icon: typeof Send }> = {
  sent: { bg: "bg-blue-500/15", text: "text-blue-400", icon: Send },
  open: { bg: "bg-emerald-500/15", text: "text-emerald-400", icon: Eye },
  click: { bg: "bg-purple-500/15", text: "text-purple-400", icon: MousePointerClick },
  failed: { bg: "bg-red-500/15", text: "text-red-400", icon: AlertTriangle },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function ReportClient() {
  const params = useParams();
  const id = params.id as string;
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeList, setActiveList] = useState<"sent" | "opened" | "clicked" | "bounced" | null>(null);

  useEffect(() => {
    fetch(`/api/platform/campaigns/${id}/report`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div className="text-gray-500 text-sm py-12 text-center">Loading report...</div>;
  }

  if (!data?.campaign) {
    return <div className="text-gray-500 text-sm py-12 text-center">Campaign not found.</div>;
  }

  const { campaign, metrics, clicksByUrl, recentActivity } = data;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3" style={{ marginBottom: "8px" }}>
        <Link href={`/platform/campaigns/${id}`} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition">
          <ArrowLeft className="h-4 w-4" /> Back to Campaign
        </Link>
      </div>
      <div className="flex items-center justify-between" style={{ marginBottom: "32px" }}>
        <div>
          <h1 className="text-2xl font-bold text-white" style={{ marginBottom: "4px" }}>{campaign.subject}</h1>
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <span className="capitalize">{campaign.audience.replace(/_/g, " ")}</span>
            {campaign.sentAt && (
              <>
                <span>Sent {new Date(campaign.sentAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</span>
              </>
            )}
            <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${
              campaign.status === "sent" ? "bg-emerald-500/15 text-emerald-400" : "bg-yellow-500/15 text-yellow-400"
            }`}>{campaign.status}</span>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" style={{ marginBottom: "32px" }}>
        <KPI label="Sent" value={metrics.sent} icon={Send} color="text-blue-400" bgColor="bg-blue-500/10"
          active={activeList === "sent"} onClick={() => setActiveList(activeList === "sent" ? null : "sent")} />
        <KPI label="Opened" value={metrics.opened} sub={`${metrics.openRate}% open rate`} icon={Eye} color="text-emerald-400" bgColor="bg-emerald-500/10"
          active={activeList === "opened"} onClick={() => setActiveList(activeList === "opened" ? null : "opened")} />
        <KPI label="Clicked" value={metrics.clicked} sub={`${metrics.clickRate}% click rate`} icon={MousePointerClick} color="text-purple-400" bgColor="bg-purple-500/10"
          active={activeList === "clicked"} onClick={() => setActiveList(activeList === "clicked" ? null : "clicked")} />
        <KPI label="Bounced" value={metrics.failed} sub={metrics.sent > 0 ? `${Math.round((metrics.failed / metrics.sent) * 100)}% bounce rate` : undefined}
          icon={AlertTriangle} color={metrics.failed > 0 ? "text-red-400" : "text-gray-600"} bgColor={metrics.failed > 0 ? "bg-red-500/10" : "bg-white/5"}
          active={activeList === "bounced"} onClick={() => setActiveList(activeList === "bounced" ? null : "bounced")} />
      </div>

      {/* Email list panel */}
      {activeList && data.emailLists && (
        <div className="bg-[#111] border border-white/10 rounded-xl overflow-hidden" style={{ marginBottom: "32px" }}>
          <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
            <h2 className="text-white font-semibold capitalize">{activeList} Emails</h2>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500">{data.emailLists[activeList].length} emails</span>
              <button onClick={() => setActiveList(null)} className="text-gray-500 hover:text-white transition">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="max-h-[300px] overflow-y-auto divide-y divide-white/5">
            {data.emailLists[activeList].length === 0 ? (
              <p className="px-6 py-8 text-gray-500 text-sm text-center">No emails in this category yet</p>
            ) : (
              data.emailLists[activeList].map((email) => (
                <div key={email} className="px-6 py-2.5 flex items-center justify-between">
                  <span className="text-sm text-gray-300">{email}</span>
                  <a href={`mailto:${email}`} className="text-xs text-brand-accent hover:underline">Email</a>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Rates Bar */}
      <div className="grid grid-cols-3 gap-4" style={{ marginBottom: "32px" }}>
        <RateCard label="Open Rate" value={metrics.openRate} color="#10b981" />
        <RateCard label="Click Rate" value={metrics.clickRate} color="#a855f7" />
        <RateCard label="Click to Open" value={metrics.clickToOpenRate} color="#f97316" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Link Performance */}
        <div className="bg-[#111] border border-white/10 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
            <h2 className="text-white font-semibold">Link Performance</h2>
            <span className="text-xs text-gray-500">{metrics.totalClicks} total clicks</span>
          </div>
          <div className="divide-y divide-white/5">
            {clicksByUrl.length === 0 ? (
              <p className="px-6 py-8 text-gray-500 text-sm text-center">No clicks yet</p>
            ) : (
              clicksByUrl.map(([url, count]) => (
                <div key={url} className="flex items-center justify-between px-6 py-3">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <ExternalLink className="h-3.5 w-3.5 text-gray-500 shrink-0" />
                    <span className="text-sm text-gray-300 truncate">{url}</span>
                  </div>
                  <span className="text-sm font-semibold text-purple-400 shrink-0" style={{ marginLeft: "12px" }}>{count}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-[#111] border border-white/10 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-white/10">
            <h2 className="text-white font-semibold">Recent Activity</h2>
          </div>
          <div className="divide-y divide-white/5 max-h-[400px] overflow-y-auto">
            {recentActivity.length === 0 ? (
              <p className="px-6 py-8 text-gray-500 text-sm text-center">No activity yet</p>
            ) : (
              recentActivity.map((a, i) => {
                const config = EVENT_COLORS[a.event] || EVENT_COLORS.sent;
                const Icon = config.icon;
                return (
                  <div key={i} className="flex items-center gap-3 px-6 py-3">
                    <div className={`p-1.5 rounded-md ${config.bg}`}>
                      <Icon className={`h-3.5 w-3.5 ${config.text}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-gray-300 truncate block">{a.email}</span>
                    </div>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded capitalize ${config.bg} ${config.text}`}>
                      {a.event}
                    </span>
                    <span className="text-xs text-gray-600 shrink-0">{timeAgo(a.time)}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function KPI({ label, value, sub, icon: Icon, color, bgColor, active, onClick }: {
  label: string;
  value: number;
  sub?: string;
  icon: typeof Send;
  color: string;
  bgColor: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      className={`${bgColor} border rounded-xl cursor-pointer transition hover:border-white/20 ${active ? "border-white/30 ring-1 ring-white/10" : "border-white/5"}`}
      style={{ padding: "24px" }}
      onClick={onClick}
    >
      <div className="flex items-center justify-between" style={{ marginBottom: "12px" }}>
        <span className="text-xs text-gray-500 uppercase tracking-wider font-medium">{label}</span>
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
      <div className={`text-3xl font-bold ${color}`}>{value.toLocaleString()}</div>
      {sub && <div className="text-xs text-gray-500" style={{ marginTop: "4px" }}>{sub}</div>}
    </div>
  );
}

function RateCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-[#111] border border-white/10 rounded-xl" style={{ padding: "20px" }}>
      <div className="flex items-center justify-between" style={{ marginBottom: "12px" }}>
        <span className="text-xs text-gray-500 uppercase tracking-wider font-medium">{label}</span>
        <TrendingUp className="h-3.5 w-3.5 text-gray-600" />
      </div>
      <div className="text-2xl font-bold text-white" style={{ marginBottom: "8px" }}>{value}%</div>
      <div className="w-full h-2 rounded-full bg-white/5">
        <div
          className="h-2 rounded-full transition-all"
          style={{ width: `${Math.min(value, 100)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
