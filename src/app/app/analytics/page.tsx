export const dynamic = "force-dynamic";

import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getGymEntitlement } from "@/lib/owner-access";
import { planSatisfies } from "@/lib/entitlements";
import { getBasicAnalytics, getProAnalytics, type ProAnalytics } from "@/lib/analytics-metrics";
import { Sparkles, TrendingUp, Users, AlertTriangle } from "lucide-react";

export default async function AnalyticsPage() {
  const { gymId } = await requireAdmin();
  const now = new Date();

  // Pro data is fetched ONLY for Pro-entitled gyms — the boundary is enforced
  // here on the server, not by hiding sections in the browser.
  const entitlement = await getGymEntitlement(gymId);
  const isPro = planSatisfies(entitlement, "pro");

  const [basic, pro] = await Promise.all([
    getBasicAnalytics(prisma, gymId, now),
    isPro ? getProAnalytics(prisma, gymId, now) : Promise.resolve(null),
  ]);

  const BELT_COLORS: Record<string, string> = {
    white: "bg-white", blue: "bg-blue-500", purple: "bg-purple-500",
    brown: "bg-amber-700", black: "bg-gray-900 border border-gray-600",
  };
  const maxBeltCount = Math.max(...basic.beltDistribution.map((b) => b.count), 1);

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Analytics</h1>

      {/* Basic metrics — included in every plan */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Active Members" value={basic.totalMembers} sub={`+${basic.newThisMonth} this month`} />
        <StatCard
          label="Check-ins This Month"
          value={basic.attendanceThisMonth}
          sub={basic.attendanceLastMonth > 0 ? `${basic.attendanceLastMonth} last month` : "First month"}
        />
        <StatCard label="New This Month" value={basic.newThisMonth} sub={`${basic.newLastMonth} last month`} />
        <StatCard
          label="Avg Check-ins / Class Type"
          value={
            basic.topClasses.length > 0
              ? (basic.topClasses.reduce((s, c) => s + c.count, 0) / basic.topClasses.length).toFixed(1)
              : "0"
          }
          sub="This month"
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        {/* Belt Distribution */}
        <div className="bg-brand-dark border border-brand-gray rounded-lg p-6">
          <h2 className="text-white font-semibold mb-4">Belt Distribution</h2>
          <div className="space-y-3">
            {basic.beltDistribution.map(({ belt, count }) => (
              <div key={belt} className="flex items-center gap-3">
                <div className={`w-4 h-4 rounded-full ${BELT_COLORS[belt] || "bg-gray-500"}`} />
                <span className="text-gray-300 capitalize w-16">{belt}</span>
                <div className="flex-1 bg-brand-black rounded-full h-6 overflow-hidden">
                  <div
                    className="h-full bg-brand-accent/30 rounded-full flex items-center pl-2"
                    style={{ width: `${Math.max((count / maxBeltCount) * 100, 8)}%` }}
                  >
                    <span className="text-brand-accent text-xs font-bold">{count}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Classes */}
        <div className="bg-brand-dark border border-brand-gray rounded-lg p-6">
          <h2 className="text-white font-semibold mb-4">Top Classes (This Month)</h2>
          {basic.topClasses.length === 0 ? (
            <p className="text-gray-500">No attendance data yet this month.</p>
          ) : (
            <div className="space-y-3">
              {basic.topClasses.map((c, i) => (
                <div key={c.classType} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-gray-500 w-6 text-right">#{i + 1}</span>
                    <span className="text-white">{c.classType}</span>
                  </div>
                  <span className="text-brand-accent font-bold">{c.count} check-ins</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Advanced analytics — Pro only, server-gated */}
      {pro ? (
        <AdvancedSection pro={pro} />
      ) : (
        <div className="flex items-center gap-4 rounded-lg border border-brand-accent/30 bg-brand-dark p-6">
          <Sparkles className="h-6 w-6 shrink-0 text-brand-accent" />
          <div className="min-w-0 flex-1">
            <h2 className="text-white font-semibold">Advanced analytics is a Pro feature</h2>
            <p className="text-sm text-gray-400">
              Multi-week attendance trends, member-growth trends, and inactivity-risk reporting.
            </p>
          </div>
          <Link
            href="/app/billing"
            className="shrink-0 rounded-lg bg-brand-accent px-4 py-2 text-sm font-bold text-brand-black transition hover:bg-brand-accent/90"
          >
            View Plans
          </Link>
        </div>
      )}
    </div>
  );
}

function AdvancedSection({ pro }: { pro: ProAnalytics }) {
  const maxWeek = Math.max(...pro.weeklyAttendance.map((w) => w.count), 1);
  const maxMonth = Math.max(...pro.memberGrowth.map((m) => m.count), 1);
  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="bg-brand-dark border border-brand-gray rounded-lg p-6">
        <h2 className="flex items-center gap-2 text-white font-semibold mb-4">
          <TrendingUp className="h-4 w-4 text-brand-accent" /> Attendance Trend (8 weeks)
        </h2>
        <div className="flex items-end gap-1.5 h-32" role="img" aria-label={`Weekly check-ins, oldest to newest: ${pro.weeklyAttendance.map((w) => w.count).join(", ")}`}>
          {pro.weeklyAttendance.map((w) => (
            <div key={w.weekStart} className="flex-1 flex flex-col items-center gap-1 min-w-0">
              <span className="text-[10px] text-gray-500">{w.count}</span>
              <div
                className="w-full rounded-t bg-brand-accent/40"
                style={{ height: `${Math.max((w.count / maxWeek) * 100, 3)}%` }}
              />
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-gray-600">Check-ins per week, oldest on the left.</p>
      </div>

      <div className="bg-brand-dark border border-brand-gray rounded-lg p-6">
        <h2 className="flex items-center gap-2 text-white font-semibold mb-4">
          <Users className="h-4 w-4 text-brand-accent" /> Member Growth (6 months)
        </h2>
        <div className="space-y-2">
          {pro.memberGrowth.map((m) => (
            <div key={m.month} className="flex items-center gap-3">
              <span className="w-16 text-xs text-gray-400">{m.month}</span>
              <div className="flex-1 bg-brand-black rounded-full h-4 overflow-hidden">
                <div className="h-full bg-brand-accent/30 rounded-full" style={{ width: `${Math.max((m.count / maxMonth) * 100, 3)}%` }} />
              </div>
              <span className="w-6 text-right text-xs font-bold text-brand-accent">{m.count}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-gray-600">New members per month.</p>
      </div>

      <div className="bg-brand-dark border border-brand-gray rounded-lg p-6 lg:col-span-2">
        <h2 className="flex items-center gap-2 text-white font-semibold mb-4">
          <AlertTriangle className="h-4 w-4 text-yellow-400" /> Inactivity Risk (no check-in in 30 days)
        </h2>
        {pro.inactivityRisk.length === 0 ? (
          <p className="text-gray-500">Every active member has trained in the last 30 days.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-white/10">
                  <th className="py-2 pr-4 font-medium">Member</th>
                  <th className="py-2 font-medium">Last check-in</th>
                </tr>
              </thead>
              <tbody>
                {pro.inactivityRisk.map((m) => (
                  <tr key={m.memberId} className="border-b border-white/5 last:border-0">
                    <td className="py-2 pr-4 text-white">{m.name}</td>
                    <td className="py-2 text-gray-400">{m.lastCheckIn ?? "Never"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-brand-dark border border-brand-gray rounded-lg p-5">
      <p className="text-gray-400 text-sm mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-gray-500 text-xs mt-1">{sub}</p>}
    </div>
  );
}
