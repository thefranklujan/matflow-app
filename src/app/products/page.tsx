import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import ProductCard from "@/components/products/ProductCard";
import Link from "next/link";
import { DEFAULT_CATEGORIES } from "@/lib/constants";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; sort?: string; search?: string }>;
}) {
  const params = await searchParams;
  const { category, sort, search } = params;

  const where: Prisma.ProductWhereInput = { active: true };
  if (category) {
    where.category = { slug: category };
  }
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { description: { contains: search } },
    ];
  }

  const orderBy: Prisma.ProductOrderByWithRelationInput = {};
  switch (sort) {
    case "price-asc":
      orderBy.price = "asc";
      break;
    case "price-desc":
      orderBy.price = "desc";
      break;
    case "name":
      orderBy.name = "asc";
      break;
    default:
      orderBy.createdAt = "desc";
  }

  const products = await prisma.product.findMany({
    where,
    orderBy,
    include: {
      category: true,
      images: { orderBy: { sortOrder: "asc" }, take: 1 },
      variants: true,
    },
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-white mb-8">
        {category
          ? DEFAULT_CATEGORIES.find((c) => c.slug === category)?.name || "Products"
          : "All Products"}
      </h1>

      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-4 mb-8">
        <div className="flex flex-wrap gap-2">
          <Link
            href="/products"
            className={`px-3 py-1.5 rounded-lg text-sm transition ${
              !category
                ? "bg-brand-teal text-brand-black font-bold"
                : "bg-brand-dark text-gray-300 border border-brand-gray hover:border-brand-teal"
            }`}
          >
            All
          </Link>
          {DEFAULT_CATEGORIES.map((cat) => (
            <Link
              key={cat.slug}
              href={`/products?category=${cat.slug}`}
              className={`px-3 py-1.5 rounded-lg text-sm transition ${
                category === cat.slug
                  ? "bg-brand-teal text-brand-black font-bold"
                  : "bg-brand-dark text-gray-300 border border-brand-gray hover:border-brand-teal"
              }`}
            >
              {cat.name}
            </Link>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-gray-400">Sort:</span>
          <Link
            href={`/products?${category ? `category=${category}&` : ""}sort=price-asc`}
            className={`text-sm ${sort === "price-asc" ? "text-brand-teal" : "text-gray-400 hover:text-white"}`}
          >
            Price Low
          </Link>
          <Link
            href={`/products?${category ? `category=${category}&` : ""}sort=price-desc`}
            className={`text-sm ${sort === "price-desc" ? "text-brand-teal" : "text-gray-400 hover:text-white"}`}
          >
            Price High
          </Link>
          <Link
            href={`/products?${category ? `category=${category}&` : ""}sort=name`}
            className={`text-sm ${sort === "name" ? "text-brand-teal" : "text-gray-400 hover:text-white"}`}
          >
            Name
          </Link>
        </div>
      </div>

      {/* Product Grid */}
      {products.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <p className="text-gray-400 text-lg">No products found.</p>
          <Link href="/products" className="text-brand-teal hover:underline mt-2 inline-block">
            View all products
          </Link>
        </div>
      )}
    </div>
  );
}
