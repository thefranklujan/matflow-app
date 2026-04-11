export const dynamic = "force-dynamic";

import { getAuthContext } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { formatCurrency, formatTime } from "@/lib/utils";
import { ShareLinkCard } from "@/components/ShareLinkCard";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default async function DashboardPage() {
  let ctx;
  try {
    ctx = await getAuthContext();
  } catch {
    redirect("/sign-in");
  }

  if (!ctx.gymId) redirect("/sign-in");

  const isAdmin = ctx.orgRole === "org:admin";

  if (isAdmin) {
    return <AdminDashboard gymId={ctx.gymId} />;
  }
  return <MemberDashboard gymId={ctx.gymId} memberId={ctx.memberId!} />;
}

async function AdminDashboard({ gymId }: { gymId: string }) {
  const [productCount, orderCount, lowStockCount, recentOrders, memberCount, gym] =
    await Promise.all([
      prisma.product.count({ where: { gymId, active: true } }),
      prisma.order.count({ where: { gymId } }),
      prisma.productVariant.count({ where: { product: { gymId }, stock: { lte: 3 } } }),
      prisma.order.findMany({
        where: { gymId },
        take: 5,
        orderBy: { createdAt: "desc" },
        include: { items: true },
      }),
      prisma.member.count({ where: { gymId, active: true } }),
      prisma.gym.findUnique({ where: { id: gymId }, select: { slug: true } }),
    ]);

  const stats = [
    { label: "Active Members", value: memberCount, href: "/app/members", color: "text-[#c4b5a0]" },
    { label: "Active Products", value: productCount, href: "/app/products", color: "text-[#c4b5a0]" },
    { label: "Total Orders", value: orderCount, href: "/app/orders", color: "text-blue-400" },
    { label: "Low Stock Items", value: lowStockCount, href: "/app/inventory", color: lowStockCount > 0 ? "text-red-400" : "text-green-400" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-8">Dashboard</h1>

      {gym?.slug && (
        <div style={{ marginBottom: "24px" }}>
          <ShareLinkCard slug={gym.slug} />
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="bg-[#1a1a1a] border border-white/10 rounded-lg p-6 hover:border-[#c4b5a0]/30 transition"
          >
            <p className="text-sm text-gray-400 mb-1">{stat.label}</p>
            <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
          </Link>
        ))}
      </div>

      <div className="bg-[#1a1a1a] border border-white/10 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Recent Orders</h2>
          <Link href="/app/orders" className="text-sm text-[#c4b5a0] hover:underline">View all</Link>
        </div>
        {recentOrders.length > 0 ? (
          <div className="space-y-3">
            {recentOrders.map((order) => (
              <Link
                key={order.id}
                href={`/app/orders/${order.id}`}
                className="flex items-center justify-between py-3 border-b border-white/5 last:border-0 hover:bg-white/5 px-2 rounded transition"
              >
                <div>
                  <p className="text-white text-sm font-medium">{order.customerName}</p>
                  <p className="text-gray-500 text-xs">
                    {new Date(order.createdAt).toLocaleDateString()} &middot; {order.items.length} item{order.items.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[#c4b5a0] font-bold text-sm">{formatCurrency(order.total)}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    order.status === "pending" ? "bg-yellow-500/20 text-yellow-400"
                    : order.status === "confirmed" ? "bg-blue-500/20 text-blue-400"
                    : order.status === "delivered" ? "bg-green-500/20 text-green-400"
                    : "bg-red-500/20 text-red-400"
                  }`}>{order.status}</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">No orders yet.</p>
        )}
      </div>
    </div>
  );
}

async function MemberDashboard({ gymId, memberId }: { gymId: string; memberId: string }) {
  const now = new Date();
  const todayDayOfWeek = now.getDay();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [member, announcements, todaySchedule, monthlyAttendance] = await Promise.all([
    prisma.member.findUnique({ where: { id: memberId } }),
    prisma.announcement.findMany({
      where: { gymId },
      orderBy: [{ pinned: "desc" }, { publishedAt: "desc" }],
      take: 5,
    }),
    prisma.classSchedule.findMany({
      where: { gymId, dayOfWeek: todayDayOfWeek, active: true },
      orderBy: { startTime: "asc" },
    }),
    prisma.attendance.count({
      where: { memberId, classDate: { gte: startOfMonth } },
    }),
  ]);

  if (!member) return <p className="text-gray-500">Member not found</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white uppercase tracking-wide">
            Welcome back
          </h1>
          <p className="text-gray-400 text-sm">
            {DAY_NAMES[now.getDay()]}, {now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-[#1a1a1a] border border-white/10 rounded-lg p-5">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Classes This Month</p>
          <p className="text-2xl font-bold text-white">{monthlyAttendance}</p>
        </div>
        <div className="bg-[#1a1a1a] border border-white/10 rounded-lg p-5">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Current Belt</p>
          <p className="text-2xl font-bold text-white capitalize">{member.beltRank}</p>
        </div>
        <div className="bg-[#1a1a1a] border border-white/10 rounded-lg p-5">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Stripes</p>
          <p className="text-2xl font-bold text-[#c4b5a0]">{member.stripes}</p>
        </div>
      </div>

      {/* Today's Schedule */}
      <div className="bg-[#1a1a1a] border border-white/10 rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Today&apos;s Schedule</h2>
          <Link href="/app/schedule" className="text-[#c4b5a0] text-sm hover:underline">Full schedule</Link>
        </div>
        {todaySchedule.length > 0 ? (
          <div className="space-y-3">
            {todaySchedule.map((cls) => (
              <div key={cls.id} className="flex items-center justify-between">
                <div>
                  <p className="text-white font-medium">{cls.classType}</p>
                  <p className="text-gray-500 text-sm">{cls.instructor} &middot; {cls.locationSlug}{cls.topic ? ` &middot; ${cls.topic}` : ""}</p>
                </div>
                <p className="text-[#c4b5a0] text-sm font-medium">{formatTime(cls.startTime)} - {formatTime(cls.endTime)}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">No classes scheduled today.</p>
        )}
      </div>

      {/* Announcements */}
      {announcements.length > 0 && (
        <div className="bg-[#1a1a1a] border border-white/10 rounded-lg p-6">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Announcements</h2>
          <div className="space-y-4">
            {announcements.map((ann) => (
              <div key={ann.id}>
                <div className="flex items-center gap-2 mb-1">
                  {ann.pinned && <span className="bg-green-500/20 text-green-400 px-2 py-0.5 rounded text-xs font-medium">Pinned</span>}
                  <h3 className="text-white font-semibold">{ann.title}</h3>
                </div>
                <p className="text-gray-400 text-sm">{ann.content}</p>
                <p className="text-gray-600 text-xs mt-1">{new Date(ann.publishedAt).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
