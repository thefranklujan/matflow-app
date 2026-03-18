import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import OrderStatusUpdater from "./OrderStatusUpdater";
import AdminShell from "@/components/admin/AdminShell";

export const dynamic = "force-dynamic";

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: {
        include: { product: true, variant: true },
      },
    },
  });

  if (!order) return notFound();

  return (
    <AdminShell>
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-white mb-2">Order Details</h1>
      <p className="text-gray-400 text-sm font-mono mb-8">{order.id}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Customer Info */}
        <div className="bg-brand-dark border border-brand-gray rounded-lg p-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Customer</h2>
          <p className="text-white">{order.customerName}</p>
          <p className="text-gray-400 text-sm">{order.customerEmail}</p>
          {order.customerPhone && <p className="text-gray-400 text-sm">{order.customerPhone}</p>}
          {order.shippingAddress && (
            <p className="text-gray-400 text-sm mt-2">{order.shippingAddress}</p>
          )}
        </div>

        {/* Order Status */}
        <div className="bg-brand-dark border border-brand-gray rounded-lg p-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Status</h2>
          <OrderStatusUpdater orderId={order.id} currentStatus={order.status} />
          <p className="text-gray-500 text-xs mt-3">
            Created: {new Date(order.createdAt).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Items */}
      <div className="bg-brand-dark border border-brand-gray rounded-lg p-6">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Items</h2>
        <div className="space-y-3">
          {order.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between py-2 border-b border-brand-gray/50 last:border-0">
              <div>
                <p className="text-white text-sm">{item.product.name}</p>
                <p className="text-gray-500 text-xs">
                  {item.variant.size}
                  {item.variant.color ? ` / ${item.variant.color}` : ""} &middot; Qty: {item.quantity}
                </p>
              </div>
              <p className="text-brand-teal font-bold text-sm">
                {formatCurrency(item.unitPrice * item.quantity)}
              </p>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-brand-gray">
          <span className="text-gray-300 font-medium">Total</span>
          <span className="text-xl font-bold text-brand-teal">{formatCurrency(order.total)}</span>
        </div>
      </div>
    </div>
    </AdminShell>
  );
}
