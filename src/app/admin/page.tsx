import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";


export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [productCount, orderCount, lowStockCount, recentOrders] =
    await Promise.all([
      prisma.product.count({ where: { active: true } }),
      prisma.order.count(),
      prisma.productVariant.count({ where: { stock: { lte: 3 } } }),
      prisma.order.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        include: { items: true },
      }),
    ]);

  const stats = [
    { label: "Active Products", value: productCount, href: "/admin/products", color: "text-brand-accent" },
    { label: "Total Orders", value: orderCount, href: "/admin/orders", color: "text-blue-400" },
    { label: "Low Stock Items", value: lowStockCount, href: "/admin/inventory", color: lowStockCount > 0 ? "text-red-400" : "text-green-400" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-8">Dashboard</h1>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="bg-brand-dark border border-brand-gray rounded-lg p-6 hover:border-brand-accent transition"
          >
            <p className="text-sm text-gray-400 mb-1">{stat.label}</p>
            <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
          </Link>
        ))}
      </div>

      {/* Recent Orders */}
      <div className="bg-brand-dark border border-brand-gray rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Recent Orders</h2>
          <Link href="/admin/orders" className="text-sm text-brand-accent hover:underline">
            View all
          </Link>
        </div>
        {recentOrders.length > 0 ? (
          <div className="space-y-3">
            {recentOrders.map((order) => (
              <Link
                key={order.id}
                href={`/admin/orders/${order.id}`}
                className="flex items-center justify-between py-3 border-b border-brand-gray last:border-0 hover:bg-brand-gray/20 px-2 rounded transition"
              >
                <div>
                  <p className="text-white text-sm font-medium">{order.customerName}</p>
                  <p className="text-gray-500 text-xs">
                    {new Date(order.createdAt).toLocaleDateString()} &middot;{" "}
                    {order.items.length} item{order.items.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-brand-accent font-bold text-sm">{formatCurrency(order.total)}</p>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      order.status === "pending"
                        ? "bg-yellow-500/20 text-yellow-400"
                        : order.status === "confirmed"
                        ? "bg-blue-500/20 text-blue-400"
                        : order.status === "shipped"
                        ? "bg-purple-500/20 text-purple-400"
                        : order.status === "delivered"
                        ? "bg-green-500/20 text-green-400"
                        : "bg-red-500/20 text-red-400"
                    }`}
                  >
                    {order.status}
                  </span>
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
