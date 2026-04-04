export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function PlatformDashboard() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    gyms,
    totalMembers,
    newMembersThisMonth,
    totalOrders,
    orderRevenue,
    totalAttendance,
  ] = await Promise.all([
    prisma.gym.findMany({
      include: {
        _count: { select: { members: true, products: true, orders: true, classSchedules: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.member.count({ where: { active: true } }),
    prisma.member.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.order.count(),
    prisma.order.aggregate({ _sum: { total: true } }),
    prisma.attendance.count(),
  ]);

  const activeGyms = gyms.filter(g => g.subscriptionStatus !== "cancelled");
  const trialingGyms = gyms.filter(g => g.subscriptionStatus === "trialing");
  const paidGyms = gyms.filter(g => g.subscriptionStatus === "active");

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-2">Platform Dashboard</h1>
      <p className="text-gray-500 mb-8">Overview of all gyms and platform metrics</p>

      {/* Platform KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-10">
        <KPI label="Total Gyms" value={gyms.length} color="text-white" />
        <KPI label="Active / Trialing" value={`${paidGyms.length} / ${trialingGyms.length}`} color="text-[#0fe69b]" />
        <KPI label="Total Members" value={totalMembers} sub={`+${newMembersThisMonth} this month`} color="text-[#0fe69b]" />
        <KPI label="Total Orders" value={totalOrders} sub={`$${(orderRevenue._sum.total || 0).toFixed(0)} revenue`} color="text-blue-400" />
        <KPI label="Total Check-ins" value={totalAttendance} color="text-purple-400" />
      </div>

      {/* Gym Table */}
      <div className="bg-[#111] border border-white/10 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">All Gyms</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5 text-xs text-gray-500 uppercase tracking-wider">
                <th className="text-left px-6 py-3">Gym</th>
                <th className="text-left px-6 py-3">Slug</th>
                <th className="text-center px-6 py-3">Members</th>
                <th className="text-center px-6 py-3">Products</th>
                <th className="text-center px-6 py-3">Orders</th>
                <th className="text-center px-6 py-3">Classes</th>
                <th className="text-center px-6 py-3">Status</th>
                <th className="text-left px-6 py-3">Trial Ends</th>
                <th className="text-left px-6 py-3">Created</th>
                <th className="text-center px-6 py-3">Links</th>
              </tr>
            </thead>
            <tbody>
              {gyms.map((gym) => {
                const statusColor =
                  gym.subscriptionStatus === "active" ? "bg-green-500/20 text-green-400"
                  : gym.subscriptionStatus === "trialing" ? "bg-yellow-500/20 text-yellow-400"
                  : gym.subscriptionStatus === "cancelled" ? "bg-red-500/20 text-red-400"
                  : "bg-gray-500/20 text-gray-400";

                return (
                  <tr key={gym.id} className="border-b border-white/5 hover:bg-white/[0.02] transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-[#0fe69b]/10 flex items-center justify-center text-[#0fe69b] text-xs font-bold">
                          {gym.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                        </div>
                        <span className="text-white font-medium">{gym.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-400 text-sm font-mono">{gym.slug}</td>
                    <td className="px-6 py-4 text-center text-white">{gym._count.members}</td>
                    <td className="px-6 py-4 text-center text-white">{gym._count.products}</td>
                    <td className="px-6 py-4 text-center text-white">{gym._count.orders}</td>
                    <td className="px-6 py-4 text-center text-white">{gym._count.classSchedules}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${statusColor}`}>
                        {gym.subscriptionStatus}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-400 text-sm">
                      {gym.trialEndsAt ? new Date(gym.trialEndsAt).toLocaleDateString() : "N/A"}
                    </td>
                    <td className="px-6 py-4 text-gray-400 text-sm">
                      {new Date(gym.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center gap-2 justify-center">
                        <Link
                          href={`/join/${gym.slug}`}
                          className="text-[#0fe69b] text-xs hover:underline"
                          target="_blank"
                        >
                          Join
                        </Link>
                        <Link
                          href={`/kiosk/${gym.slug}`}
                          className="text-blue-400 text-xs hover:underline"
                          target="_blank"
                        >
                          Kiosk
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {gyms.length === 0 && (
          <div className="px-6 py-12 text-center text-gray-500">No gyms registered yet.</div>
        )}
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
