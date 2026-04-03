export const dynamic = "force-dynamic";

import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function AnalyticsPage() {
  const { gymId } = await requireAdmin();

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  // Member stats
  const totalMembers = await prisma.member.count({ where: { gymId, active: true } });
  const newThisMonth = await prisma.member.count({
    where: { gymId, createdAt: { gte: startOfMonth } },
  });
  const newLastMonth = await prisma.member.count({
    where: { gymId, createdAt: { gte: startOfLastMonth, lt: startOfMonth } },
  });

  // Belt distribution
  const beltDistribution = await prisma.member.groupBy({
    by: ["beltRank"],
    where: { gymId, active: true },
    _count: true,
  });

  // Attendance stats
  const attendanceThisMonth = await prisma.attendance.count({
    where: { gymId, classDate: { gte: startOfMonth } },
  });
  const attendanceLastMonth = await prisma.attendance.count({
    where: { gymId, classDate: { gte: startOfLastMonth, lt: startOfMonth } },
  });

  // Top classes by attendance this month
  const topClasses = await prisma.attendance.groupBy({
    by: ["classType"],
    where: { gymId, classDate: { gte: startOfMonth } },
    _count: true,
    orderBy: { _count: { classType: "desc" } },
    take: 5,
  });

  // Order stats
  const ordersThisMonth = await prisma.order.count({
    where: { gymId, createdAt: { gte: startOfMonth } },
  });
  const orderRevenue = await prisma.order.aggregate({
    where: { gymId, createdAt: { gte: startOfMonth } },
    _sum: { total: true },
  });
  const totalRevenue = await prisma.order.aggregate({
    where: { gymId },
    _sum: { total: true },
  });

  // Products stats
  const totalProducts = await prisma.product.count({ where: { gymId, active: true } });
  const lowStock = await prisma.productVariant.count({
    where: { product: { gymId }, stock: { lte: 3 } },
  });

  // Gym subscription info
  const gym = await prisma.gym.findUnique({
    where: { id: gymId },
    select: { subscriptionStatus: true, trialEndsAt: true },
  });

  const BELT_COLORS: Record<string, string> = {
    white: "bg-white", blue: "bg-blue-500", purple: "bg-purple-500",
    brown: "bg-amber-700", black: "bg-gray-900 border border-gray-600",
  };

  const BELT_ORDER = ["white", "blue", "purple", "brown", "black"];
  const sortedBelts = BELT_ORDER.map((b) => ({
    belt: b,
    count: beltDistribution.find((d) => d.beltRank === b)?._count || 0,
  }));

  const maxBeltCount = Math.max(...sortedBelts.map((b) => b.count), 1);

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Analytics</h1>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Active Members" value={totalMembers} sub={`+${newThisMonth} this month`} />
        <StatCard
          label="Check-ins This Month"
          value={attendanceThisMonth}
          sub={attendanceLastMonth > 0 ? `${attendanceLastMonth} last month` : "First month"}
        />
        <StatCard
          label="Pro Shop Revenue"
          value={`$${(orderRevenue._sum.total || 0).toFixed(0)}`}
          sub={`${ordersThisMonth} orders this month`}
        />
        <StatCard
          label="Subscription"
          value={gym?.subscriptionStatus === "active" ? "Active" : gym?.subscriptionStatus || "Trial"}
          sub={gym?.trialEndsAt ? `Trial ends ${new Date(gym.trialEndsAt).toLocaleDateString()}` : ""}
          highlight={gym?.subscriptionStatus !== "active"}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Belt Distribution */}
        <div className="bg-brand-dark border border-brand-gray rounded-lg p-6">
          <h2 className="text-white font-semibold mb-4">Belt Distribution</h2>
          <div className="space-y-3">
            {sortedBelts.map(({ belt, count }) => (
              <div key={belt} className="flex items-center gap-3">
                <div className={`w-4 h-4 rounded-full ${BELT_COLORS[belt] || "bg-gray-500"}`} />
                <span className="text-gray-300 capitalize w-16">{belt}</span>
                <div className="flex-1 bg-brand-black rounded-full h-6 overflow-hidden">
                  <div
                    className="h-full bg-brand-teal/30 rounded-full flex items-center pl-2"
                    style={{ width: `${Math.max((count / maxBeltCount) * 100, 8)}%` }}
                  >
                    <span className="text-brand-teal text-xs font-bold">{count}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Classes */}
        <div className="bg-brand-dark border border-brand-gray rounded-lg p-6">
          <h2 className="text-white font-semibold mb-4">Top Classes (This Month)</h2>
          {topClasses.length === 0 ? (
            <p className="text-gray-500">No attendance data yet this month.</p>
          ) : (
            <div className="space-y-3">
              {topClasses.map((c, i) => (
                <div key={c.classType} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-gray-500 w-6 text-right">#{i + 1}</span>
                    <span className="text-white">{c.classType}</span>
                  </div>
                  <span className="text-brand-teal font-bold">{c._count} check-ins</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Growth */}
        <div className="bg-brand-dark border border-brand-gray rounded-lg p-6">
          <h2 className="text-white font-semibold mb-4">Member Growth</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-gray-400 text-sm">New This Month</p>
              <p className="text-2xl font-bold text-brand-teal">{newThisMonth}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">New Last Month</p>
              <p className="text-2xl font-bold text-gray-300">{newLastMonth}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Total Active</p>
              <p className="text-2xl font-bold text-white">{totalMembers}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Avg Attendance / Class</p>
              <p className="text-2xl font-bold text-white">
                {topClasses.length > 0
                  ? (topClasses.reduce((s, c) => s + c._count, 0) / topClasses.length).toFixed(1)
                  : "0"}
              </p>
            </div>
          </div>
        </div>

        {/* Inventory */}
        <div className="bg-brand-dark border border-brand-gray rounded-lg p-6">
          <h2 className="text-white font-semibold mb-4">Pro Shop</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-gray-400 text-sm">Active Products</p>
              <p className="text-2xl font-bold text-white">{totalProducts}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Low Stock Items</p>
              <p className={`text-2xl font-bold ${lowStock > 0 ? "text-red-400" : "text-green-400"}`}>{lowStock}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Total Revenue</p>
              <p className="text-2xl font-bold text-brand-teal">${(totalRevenue._sum.total || 0).toFixed(0)}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Orders This Month</p>
              <p className="text-2xl font-bold text-white">{ordersThisMonth}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, highlight }: { label: string; value: string | number; sub?: string; highlight?: boolean }) {
  return (
    <div className={`bg-brand-dark border rounded-lg p-5 ${highlight ? "border-yellow-500/30" : "border-brand-gray"}`}>
      <p className="text-gray-400 text-sm mb-1">{label}</p>
      <p className={`text-2xl font-bold ${highlight ? "text-yellow-400" : "text-white"}`}>{value}</p>
      {sub && <p className="text-gray-500 text-xs mt-1">{sub}</p>}
    </div>
  );
}
