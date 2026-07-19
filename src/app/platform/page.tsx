export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import Link from "next/link";
import DemoModeButton from "./DemoModeButton";
import {
  buildFounderBreakdown,
  priceAllowListConfigured,
  UNAVAILABLE_METRICS,
  SYNTHETIC_GYM_IDS,
  STUCK_DAYS,
  type FounderGymRow,
} from "@/lib/founder-metrics";
import { Users, Flame, AlertTriangle, Clock, Scale } from "lucide-react";

export default async function PlatformDashboard() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const realGymFilter = { id: { notIn: SYNTHETIC_GYM_IDS } };

  const [gyms, totalMembers, newMembersThisMonth, attendanceLast7, attendanceLast30] = await Promise.all([
    prisma.gym.findMany({
      where: realGymFilter,
      include: { _count: { select: { members: { where: { active: true } } } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.member.count({ where: { active: true, gymId: { notIn: SYNTHETIC_GYM_IDS } } }),
    prisma.member.count({ where: { createdAt: { gte: startOfMonth }, gymId: { notIn: SYNTHETIC_GYM_IDS } } }),
    prisma.attendance.count({ where: { classDate: { gte: sevenDaysAgo }, gymId: { notIn: SYNTHETIC_GYM_IDS } } }),
    prisma.attendance.count({ where: { classDate: { gte: thirtyDaysAgo }, gymId: { notIn: SYNTHETIC_GYM_IDS } } }),
  ]);

  const [nominationCount, totalStudents, hotNominations, totalGroupMembers, topGroups] = await Promise.all([
    prisma.gymNomination.count(),
    prisma.student.count({
      where: {
        NOT: { OR: [{ email: { endsWith: "@matflow-sample.com" } }, { email: { endsWith: "@example.com" } }] },
      },
    }),
    prisma.gymNomination.groupBy({
      by: ["gymName"],
      _count: { gymName: true },
      having: { gymName: { _count: { gte: 3 } } },
      orderBy: { _count: { gymName: "desc" } },
      take: 5,
    }),
    prisma.gymGroupMember.count({ where: { status: "active" } }),
    prisma.gymGroup.findMany({
      where: { memberCount: { gt: 0 } },
      orderBy: { memberCount: "desc" },
      take: 6,
      select: { id: true, name: true, city: true, state: true, memberCount: true },
    }),
  ]);

  const rows: FounderGymRow[] = gyms.map((g) => ({
    id: g.id,
    name: g.name,
    subscriptionStatus: g.subscriptionStatus,
    stripePriceId: g.stripePriceId,
    trialEndsAt: g.trialEndsAt,
    approved: g.approved,
    createdAt: g.createdAt,
    activeMemberCount: g._count.members,
  }));
  const b = buildFounderBreakdown(rows, now);
  const allowListReady = priceAllowListConfigured();
  const newGymsThisMonth = rows.filter((g) => g.createdAt >= startOfMonth).length;

  return (
    <div>
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Platform Dashboard</h1>
          <p className="text-gray-500">
            Real academies only (synthetic platform gyms excluded). Data as of {now.toLocaleString()}.
          </p>
        </div>
        <DemoModeButton />
      </div>

      {/* Academies + revenue estimate */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <KPI label="Real Academies" value={b.totalReal} sub={`+${newGymsThisMonth} this month`} />
        <KPI
          label="Paid (allow-listed)"
          value={b.counts.basic + b.counts.pro}
          sub={`${b.counts.basic} Basic · ${b.counts.pro} Pro`}
          color="text-green-400"
        />
        <KPI
          label="List-price gross MRR (estimate)"
          value={allowListReady ? `$${b.grossMrrEstimateUsd}` : "—"}
          sub={
            allowListReady
              ? `List prices only (Basic×$49 + Pro×$99), not Stripe cash · excludes ${b.reconciliation.length} unreconciled`
              : "Price allow-list not configured (Access Needed)"
          }
          color="text-orange-400"
        />
        <KPI
          label="Trials"
          value={b.counts.trialing_valid}
          sub={`${b.counts.trial_expired} expired · ${b.trialsEnding7d.length} ending in 7d`}
          color="text-yellow-400"
        />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <KPI label="Active Members" value={totalMembers} sub={`${newMembersThisMonth} member records created this month`} />
        <KPI label="Activated Academies" value={b.activatedGyms} sub="2+ active members" />
        <KPI label="Check-ins (7d)" value={attendanceLast7} sub={`${attendanceLast30} in 30d`} color="text-purple-400" />
        <KPI label="Students" value={totalStudents} sub={`${nominationCount} nominations · ${totalGroupMembers} in communities`} color="text-cyan-400" />
      </div>

      {/* Reconciliation — money never guessed */}
      {b.reconciliation.length > 0 && (
        <div className="bg-[#111] border border-orange-500/30 rounded-lg p-5 mb-6">
          <h2 className="flex items-center gap-2 text-white font-semibold mb-1">
            <Scale className="h-4 w-4 text-orange-400" /> Billing reconciliation needed
          </h2>
          <p className="text-gray-500 text-xs mb-3">
            Excluded from the MRR estimate: unknown active prices, legacy free, unrecognized states.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {b.reconciliation.map((r) => (
              <Link key={r.gymId} href={`/platform/gyms/${r.gymId}`} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 hover:border-orange-500/40 transition">
                <span className="text-white text-sm truncate">{r.name}</span>
                <span className="text-orange-400 text-xs shrink-0 ml-2">{r.reason.replace(/_/g, " ")}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        {/* Trials ending soon */}
        <div className="bg-[#111] border border-yellow-500/30 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-white font-semibold"><Clock className="h-4 w-4 text-yellow-400" /> Trials Ending Soon</h2>
              <p className="text-gray-500 text-xs">Valid trials ending within 7 days</p>
            </div>
            <span className="bg-yellow-500/20 text-yellow-400 text-xs font-bold px-2 py-1 rounded">{b.trialsEnding7d.length}</span>
          </div>
          <div className="divide-y divide-white/5">
            {b.trialsEnding7d.length === 0 ? (
              <p className="px-6 py-8 text-gray-500 text-sm text-center">No trials ending in the next 7 days</p>
            ) : (
              b.trialsEnding7d.map((t) => (
                <Link key={t.gymId} href={`/platform/gyms/${t.gymId}`} className="flex items-center justify-between px-6 py-3 hover:bg-white/5 transition">
                  <p className="text-white text-sm font-medium">{t.name}</p>
                  <span className="text-yellow-400 text-xs font-bold">{t.daysLeft}d left</span>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Needs onboarding help */}
        <div className="bg-[#111] border border-red-500/30 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-white font-semibold"><AlertTriangle className="h-4 w-4 text-red-400" /> Needs Onboarding Help</h2>
              <p className="text-gray-500 text-xs">Approved, access-holding academies with ≤1 active member {STUCK_DAYS}+ days after signup</p>
            </div>
            <span className="bg-red-500/20 text-red-400 text-xs font-bold px-2 py-1 rounded">{b.needsOnboardingHelp.length}</span>
          </div>
          <div className="divide-y divide-white/5">
            {b.needsOnboardingHelp.length === 0 ? (
              <p className="px-6 py-8 text-gray-500 text-sm text-center">No access-holding academy is stuck at one active member</p>
            ) : (
              b.needsOnboardingHelp.slice(0, 5).map((g) => (
                <Link key={g.gymId} href={`/platform/gyms/${g.gymId}`} className="flex items-center justify-between px-6 py-3 hover:bg-white/5 transition">
                  <p className="text-white text-sm font-medium">{g.name}</p>
                  <span className="text-gray-500 text-xs">since {new Date(g.createdAt).toLocaleDateString()}</span>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Community signals */}
      {(topGroups.length > 0 || hotNominations.length > 0) && (
        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          {topGroups.length > 0 && (
            <div className="bg-[#111] border border-white/10 rounded-lg p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="flex items-center gap-2 text-white font-semibold"><Users className="h-4 w-4 text-cyan-400" /> Top Gym Communities</h2>
                <Link href="/platform/nominations" className="text-cyan-400 text-sm hover:underline">Nominations</Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {topGroups.map((g) => (
                  <Link key={g.id} href={`/platform/groups/${g.id}`} className="rounded-lg border border-white/10 bg-white/5 p-3 hover:border-cyan-500/40 transition block">
                    <p className="text-white text-sm font-semibold truncate">{g.name}</p>
                    <p className="text-cyan-400 text-xs mt-0.5">{g.memberCount} active</p>
                  </Link>
                ))}
              </div>
            </div>
          )}
          {hotNominations.length > 0 && (
            <div className="bg-[#111] border border-white/10 rounded-lg p-5">
              <h2 className="flex items-center gap-2 text-white font-semibold mb-3">
                <Flame className="h-4 w-4 text-orange-400" /> Hot Nominations
                <span className="text-xs text-gray-500 font-normal">3+ students, same gym</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {hotNominations.map((n) => (
                  <div key={n.gymName} className="rounded-lg border border-white/10 bg-white/5 p-3">
                    <p className="text-white text-sm font-semibold truncate">{n.gymName}</p>
                    <p className="text-orange-400 text-xs mt-0.5">{n._count.gymName} nominating</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recent signups */}
      <div className="bg-[#111] border border-white/10 rounded-lg overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-white font-semibold">Recent Signups</h2>
          <Link href="/platform/gyms" className="text-orange-400 text-sm hover:underline">View all gyms</Link>
        </div>
        <div className="divide-y divide-white/5">
          {rows.slice(0, 5).map((gym) => (
            <Link key={gym.id} href={`/platform/gyms/${gym.id}`} className="flex items-center justify-between px-6 py-4 hover:bg-white/5 transition">
              <div className="min-w-0">
                <p className="text-white text-sm font-medium truncate">{gym.name}</p>
                <p className="text-gray-500 text-xs">{gym.activeMemberCount} active member{gym.activeMemberCount !== 1 ? "s" : ""}</p>
              </div>
              <div className="text-right shrink-0 ml-3">
                <p className="text-gray-400 text-xs">{new Date(gym.createdAt).toLocaleDateString()}</p>
                <span className={`text-xs font-medium capitalize ${
                  gym.subscriptionStatus === "active" ? "text-green-400"
                  : gym.subscriptionStatus === "trialing" ? "text-yellow-400"
                  : "text-gray-500"
                }`}>{gym.subscriptionStatus}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Explicit gaps — never faked */}
      <div className="bg-[#111] border border-white/10 rounded-lg p-5">
        <h2 className="text-white font-semibold mb-1">Not available yet</h2>
        <p className="text-gray-500 text-xs mb-3">These metrics have no trustworthy source today and are never estimated.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
          {UNAVAILABLE_METRICS.map((m) => (
            <div key={m.label} className="flex items-center justify-between text-sm">
              <span className="text-gray-400">{m.label}</span>
              <span className={`text-xs font-medium ${m.status === "Access Needed" ? "text-orange-400" : "text-gray-600"}`}>
                {m.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function KPI({ label, value, sub, color = "text-white" }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-[#111] border border-white/10 rounded-lg p-5">
      <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-gray-500 text-xs mt-1">{sub}</p>}
    </div>
  );
}
