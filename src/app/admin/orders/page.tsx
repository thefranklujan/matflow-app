import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import AdminShell from "@/components/admin/AdminShell";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  const orders = await prisma.order.findMany({
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <AdminShell>
    <div>
      <h1 className="text-2xl font-bold text-white mb-8">Orders</h1>

      <div className="bg-brand-dark border border-brand-gray rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-brand-gray">
              <th className="text-left text-xs text-gray-400 uppercase tracking-wider px-4 py-3">Order</th>
              <th className="text-left text-xs text-gray-400 uppercase tracking-wider px-4 py-3">Customer</th>
              <th className="text-left text-xs text-gray-400 uppercase tracking-wider px-4 py-3">Items</th>
              <th className="text-left text-xs text-gray-400 uppercase tracking-wider px-4 py-3">Total</th>
              <th className="text-left text-xs text-gray-400 uppercase tracking-wider px-4 py-3">Status</th>
              <th className="text-left text-xs text-gray-400 uppercase tracking-wider px-4 py-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} className="border-b border-brand-gray/50 hover:bg-brand-gray/20 transition">
                <td className="px-4 py-3">
                  <Link href={`/admin/orders/${order.id}`} className="text-brand-teal hover:underline text-sm font-mono">
                    {order.id.slice(0, 8)}...
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <p className="text-white text-sm">{order.customerName}</p>
                  <p className="text-gray-500 text-xs">{order.customerEmail}</p>
                </td>
                <td className="px-4 py-3 text-sm text-gray-400">
                  {order.items.length} item{order.items.length !== 1 ? "s" : ""}
                </td>
                <td className="px-4 py-3 text-sm text-brand-teal font-bold">
                  {formatCurrency(order.total)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
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
                </td>
                <td className="px-4 py-3 text-sm text-gray-400">
                  {new Date(order.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {orders.length === 0 && (
          <div className="text-center py-8 text-gray-500">No orders yet.</div>
        )}
      </div>
    </div>
    </AdminShell>
  );
}
