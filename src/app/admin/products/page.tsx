import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import DeleteProductButton from "./DeleteProductButton";


export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  const { gymId } = await requireAdmin();
  const products = await prisma.product.findMany({
    where: { gymId },
    include: {
      category: true,
      images: { take: 1, orderBy: { sortOrder: "asc" } },
      variants: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-white">Products</h1>
        <Link
          href="/admin/products/new"
          className="bg-brand-accent text-brand-black font-bold px-4 py-2 rounded-lg hover:bg-brand-accent/90 transition text-sm"
        >
          + Add Product
        </Link>
      </div>

      <div className="bg-brand-dark border border-brand-gray rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-brand-gray">
              <th className="text-left text-xs text-gray-400 uppercase tracking-wider px-4 py-3">Product</th>
              <th className="text-left text-xs text-gray-400 uppercase tracking-wider px-4 py-3">Category</th>
              <th className="text-left text-xs text-gray-400 uppercase tracking-wider px-4 py-3">Price</th>
              <th className="text-left text-xs text-gray-400 uppercase tracking-wider px-4 py-3">Stock</th>
              <th className="text-left text-xs text-gray-400 uppercase tracking-wider px-4 py-3">Status</th>
              <th className="text-right text-xs text-gray-400 uppercase tracking-wider px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => {
              const totalStock = product.variants.reduce((s, v) => s + v.stock, 0);
              return (
                <tr key={product.id} className="border-b border-brand-gray/50 hover:bg-brand-gray/20 transition">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-brand-gray rounded flex-shrink-0 overflow-hidden">
                        {product.images[0] ? (
                          <img src={product.images[0].url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-sm">🥋</div>
                        )}
                      </div>
                      <span className="text-white text-sm font-medium">{product.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">{product.category.name}</td>
                  <td className="px-4 py-3 text-sm text-brand-accent font-medium">{formatCurrency(product.price)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-sm ${totalStock <= 3 ? "text-red-400" : "text-gray-300"}`}>
                      {totalStock}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${product.active ? "bg-green-500/20 text-green-400" : "bg-gray-500/20 text-gray-400"}`}>
                      {product.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/admin/products/${product.id}/edit`}
                        className="text-sm text-gray-400 hover:text-brand-accent transition"
                      >
                        Edit
                      </Link>
                      <DeleteProductButton productId={product.id} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {products.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No products yet. Click &quot;Add Product&quot; to get started.
          </div>
        )}
      </div>
    </div>
  );
}
