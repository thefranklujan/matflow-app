import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import Link from "next/link";
import CategoryManager from "./CategoryManager";

export const dynamic = "force-dynamic";

export default async function ProductCategoriesPage() {
  const { gymId } = await requireAdmin();
  const categories = await prisma.category.findMany({
    where: { gymId },
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { products: true } } },
  });

  const initial = categories.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    productCount: c._count.products,
  }));

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link href="/app/products" className="text-sm text-gray-400 hover:text-brand-accent transition">
          &larr; Back to Products
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-white mb-2">Product Categories</h1>
      <p className="text-sm text-gray-400 mb-8">
        Organize your store. Deleting a category moves its products to
        &quot;Uncategorized&quot; so nothing is lost.
      </p>
      <CategoryManager initial={initial} />
    </div>
  );
}
