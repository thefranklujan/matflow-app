import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import ProductCard from "@/components/products/ProductCard";
import Link from "next/link";

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // TODO: scope by gymId when subdomain/slug routing is added
  const category = await prisma.category.findFirst({
    where: { slug },
  });

  if (!category) return notFound();

  const products = await prisma.product.findMany({
    where: { categoryId: category.id, active: true },
    include: {
      category: true,
      images: { orderBy: { sortOrder: "asc" }, take: 1 },
      variants: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <nav className="flex items-center gap-2 text-sm text-gray-400 mb-6">
        <Link href="/" className="hover:text-brand-teal">Home</Link>
        <span>/</span>
        <Link href="/products" className="hover:text-brand-teal">Shop</Link>
        <span>/</span>
        <span className="text-white">{category.name}</span>
      </nav>

      <h1 className="text-3xl font-bold text-white mb-8">{category.name}</h1>

      {products.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <p className="text-gray-400 text-lg">No products in this category yet.</p>
          <Link href="/products" className="text-brand-teal hover:underline mt-2 inline-block">
            Browse all products
          </Link>
        </div>
      )}
    </div>
  );
}
