export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function PlatformDashboard() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    gyms,
    totalMembers,
    newMembersThisMonth,
    totalAttendance,
    attendanceLast7,
    trialEnding,
  ] = await Promise.all([
    prisma.gym.findMany({
      include: { _count: { select: { members: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.member.count({ where: { active: true } }),
    prisma.member.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.attendance.count(),
    prisma.attendance.count({ where: { classDate: { gte: sevenDaysAgo } } }),
    prisma.gym.findMany({
      where: {
        subscriptionStatus: "trialing",
        trialEndsAt: { lte: sevenDaysFromNow, gte: now },
      },
      include: { members: { take: 1, orderBy: { createdAt: "asc" } } },
      orderBy: { trialEndsAt: "asc" },
    }),
  ]);

  const trialingGyms = gyms.filter(g => g.subscriptionStatus === "trialing");
  const paidGyms = gyms.filter(g => g.subscriptionStatus === "active");
  const newGymsThisMonth = gyms.filter(g => g.createdAt >= startOfMonth).length;

  // Inactive: gyms with only the owner (1 member) and created over 3 days ago
  const stuckGyms = gyms.filter(g =>
    g._count.members <= 1 && g.createdAt < new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)
  );

  // MRR estimate: Basic = $49, Pro = $99, default Basic for active without plan
  const mrr = paidGyms.length * 49; // simplified
  const arr = mrr * 12;

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-2">Platform Dashboard</h1>
      <p className="text-gray-500 mb-8">Operational view of MatFlow</p>

      {/* Top KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <KPI label="Total Gyms" value={gyms.length} sub={`+${newGymsThisMonth} this month`} />
        <KPI label="Paying" value={paidGyms.length} sub={`${trialingGyms.length} on trial`} color="text-green-400" />
        <KPI label="MRR" value={`$${mrr}`} sub={`$${arr.toLocaleString()} ARR`} color="text-orange-400" />
        <KPI label="Total Members" value={totalMembers} sub={`+${newMembersThisMonth} this month`} />
        <KPI label="Check-ins (7d)" value={attendanceLast7} sub={`${totalAttendance} all-time`} color="text-purple-400" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        {/* Trial Ending Soon */}
        <div className="bg-[#111] border border-yellow-500/30 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
            <div>
              <h2 className="text-white font-semibold">Trials Ending Soon</h2>
              <p className="text-gray-500 text-xs">Within the next 7 days</p>
            </div>
            <span className="bg-yellow-500/20 text-yellow-400 text-xs font-bold px-2 py-1 rounded">{trialEnding.length}</span>
          </div>
          <div className="divide-y divide-white/5">
            {trialEnding.length === 0 ? (
              <p className="px-6 py-8 text-gray-500 text-sm text-center">No trials ending in the next 7 days</p>
            ) : (
              trialEnding.map((gym) => {
                const owner = gym.members[0];
                const daysLeft = gym.trialEndsAt
                  ? Math.ceil((new Date(gym.trialEndsAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                  : 0;
                return (
                  <Link
                    key={gym.id}
                    href={`/platform/gyms/${gym.id}`}
                    className="flex items-center justify-between px-6 py-3 hover:bg-white/5 transition"
                  >
                    <div>
                      <p className="text-white text-sm font-medium">{gym.name}</p>
                      <p className="text-gray-500 text-xs">{owner?.email || "No owner"}</p>
                    </div>
                    <span className="text-yellow-400 text-xs font-bold">{daysLeft}d left</span>
                  </Link>
                );
              })
            )}
          </div>
        </div>

        {/* Stuck Gyms (signed up but no activity) */}
        <div className="bg-[#111] border border-red-500/30 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
            <div>
              <h2 className="text-white font-semibold">Needs Onboarding Help</h2>
              <p className="text-gray-500 text-xs">Created 3+ days ago, no members added</p>
            </div>
            <span className="bg-red-500/20 text-red-400 text-xs font-bold px-2 py-1 rounded">{stuckGyms.length}</span>
          </div>
          <div className="divide-y divide-white/5">
            {stuckGyms.length === 0 ? (
              <p className="px-6 py-8 text-gray-500 text-sm text-center">All gyms are active</p>
            ) : (
              stuckGyms.slice(0, 5).map((gym) => (
                <Link
                  key={gym.id}
                  href={`/platform/gyms/${gym.id}`}
                  className="flex items-center justify-between px-6 py-3 hover:bg-white/5 transition"
                >
                  <div>
                    <p className="text-white text-sm font-medium">{gym.name}</p>
                    <p className="text-gray-500 text-xs">Created {new Date(gym.createdAt).toLocaleDateString()}</p>
                  </div>
                  <span className="text-red-400 text-xs">Stuck</span>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Recent Signups */}
      <div className="bg-[#111] border border-white/10 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-white font-semibold">Recent Signups</h2>
          <Link href="/platform/gyms" className="text-orange-400 text-sm hover:underline">View all gyms &rarr;</Link>
        </div>
        <div className="divide-y divide-white/5">
          {gyms.slice(0, 5).map((gym) => (
            <Link
              key={gym.id}
              href={`/platform/gyms/${gym.id}`}
              className="flex items-center justify-between px-6 py-4 hover:bg-white/5 transition"
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded bg-[#c4b5a0]/10 flex items-center justify-center text-[#c4b5a0] text-xs font-bold">
                  {gym.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-white text-sm font-medium">{gym.name}</p>
                  <p className="text-gray-500 text-xs">{gym._count.members} member{gym._count.members !== 1 ? "s" : ""}</p>
                </div>
              </div>
              <div className="text-right">
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
