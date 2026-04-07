import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import InventoryStockEditor from "./InventoryStockEditor";


export const dynamic = "force-dynamic";

export default async function AdminInventoryPage() {
  const { gymId } = await requireAdmin();
  const variants = await prisma.productVariant.findMany({
    where: { product: { gymId } },
    include: { product: { include: { category: true } } },
    orderBy: { stock: "asc" },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-8">Inventory</h1>

      <div className="bg-brand-dark border border-brand-gray rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-brand-gray">
              <th className="text-left text-xs text-gray-400 uppercase tracking-wider px-4 py-3">Product</th>
              <th className="text-left text-xs text-gray-400 uppercase tracking-wider px-4 py-3">Category</th>
              <th className="text-left text-xs text-gray-400 uppercase tracking-wider px-4 py-3">Size</th>
              <th className="text-left text-xs text-gray-400 uppercase tracking-wider px-4 py-3">Color</th>
              <th className="text-left text-xs text-gray-400 uppercase tracking-wider px-4 py-3">Stock</th>
            </tr>
          </thead>
          <tbody>
            {variants.map((variant) => (
              <tr
                key={variant.id}
                className={`border-b border-brand-gray/50 hover:bg-brand-gray/20 transition ${
                  variant.stock <= 3 ? "bg-red-500/5" : ""
                }`}
              >
                <td className="px-4 py-3 text-sm text-white">{variant.product.name}</td>
                <td className="px-4 py-3 text-sm text-gray-400">{variant.product.category.name}</td>
                <td className="px-4 py-3 text-sm text-gray-300">{variant.size}</td>
                <td className="px-4 py-3 text-sm text-gray-400">{variant.color || "-"}</td>
                <td className="px-4 py-3">
                  <InventoryStockEditor variantId={variant.id} currentStock={variant.stock} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {variants.length === 0 && (
          <div className="text-center py-8 text-gray-500">No inventory items.</div>
        )}
      </div>
    </div>
  );
}
