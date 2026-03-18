import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { CATEGORY_SIZE_MAP } from "@/lib/constants";
import AddToCartSection from "./AddToCartSection";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const product = await prisma.product.findUnique({
    where: { slug },
    include: {
      category: true,
      images: { orderBy: { sortOrder: "asc" } },
      variants: true,
    },
  });

  if (!product || !product.active) return notFound();

  const sizes = CATEGORY_SIZE_MAP[product.category.slug] || [];
  const colors = [...new Set(product.variants.map((v) => v.color).filter(Boolean))] as string[];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-400 mb-8">
        <Link href="/" className="hover:text-brand-teal">Home</Link>
        <span>/</span>
        <Link href="/products" className="hover:text-brand-teal">Shop</Link>
        <span>/</span>
        <Link href={`/categories/${product.category.slug}`} className="hover:text-brand-teal">
          {product.category.name}
        </Link>
        <span>/</span>
        <span className="text-white">{product.name}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Images */}
        <div>
          <div className="aspect-square bg-brand-dark border border-brand-gray rounded-lg overflow-hidden mb-4">
            {product.images[0] ? (
              <img
                src={product.images[0].url}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-gray-600 text-6xl">🥋</span>
              </div>
            )}
          </div>
          {product.images.length > 1 && (
            <div className="grid grid-cols-4 gap-2">
              {product.images.map((img) => (
                <div key={img.id} className="aspect-square bg-brand-dark border border-brand-gray rounded overflow-hidden">
                  <img src={img.url} alt={img.alt || ""} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Product Info */}
        <div>
          <p className="text-brand-teal text-sm uppercase tracking-wider mb-2">
            {product.category.name}
          </p>
          <h1 className="text-3xl font-bold text-white mb-4">{product.name}</h1>

          <div className="flex items-center gap-3 mb-6">
            <span className="text-3xl font-bold text-brand-teal">
              {formatCurrency(product.price)}
            </span>
            {product.compareAt && product.compareAt > product.price && (
              <span className="text-xl text-gray-500 line-through">
                {formatCurrency(product.compareAt)}
              </span>
            )}
          </div>

          <p className="text-gray-300 mb-8 leading-relaxed">{product.description}</p>

          <AddToCartSection
            product={{
              id: product.id,
              name: product.name,
              slug: product.slug,
              price: product.price,
              image: product.images[0]?.url || null,
            }}
            variants={product.variants}
            sizes={sizes as string[]}
            colors={colors}
          />
        </div>
      </div>
    </div>
  );
}
