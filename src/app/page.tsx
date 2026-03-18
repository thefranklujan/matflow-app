export const dynamic = "force-dynamic";

import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { BRAND, CATEGORIES } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";

export default async function HomePage() {
  const featuredProducts = await prisma.product.findMany({
    where: { featured: true, active: true },
    include: {
      category: true,
      images: { orderBy: { sortOrder: "asc" }, take: 1 },
      variants: true,
    },
    take: 4,
  });

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src="/hero-banner.webp"
            alt="Ceconi BJJ"
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-black/60" />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-28 sm:py-40 relative">
          <div className="text-center">
            <Image
              src="/logo-white.svg"
              alt="Ceconi BJJ"
              width={400}
              height={120}
              className="mx-auto mb-6 h-20 sm:h-28 w-auto"
              priority
            />
            <p className="text-xl sm:text-2xl text-gray-200 mb-2 font-light tracking-wide uppercase">
              {BRAND.tagline}
            </p>
            <p className="text-gray-300 text-lg leading-relaxed max-w-2xl mx-auto mb-10">
              Gear up with official Ceconi BJJ apparel and equipment. From premium Gis to everyday wear,
              represent your academy on and off the mats.
            </p>
            <Link
              href="/products"
              className="inline-block bg-brand-teal text-brand-black font-bold px-10 py-4 rounded hover:bg-brand-teal/90 transition text-lg uppercase tracking-wider"
            >
              Shop Now
            </Link>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-3xl font-bold text-white mb-8 text-center uppercase tracking-wide">
          Shop by Category
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.slug}
              href={`/categories/${cat.slug}`}
              className="group relative bg-brand-dark border border-brand-gray rounded overflow-hidden hover:border-brand-teal transition"
            >
              <div className="p-8 text-center">
                <h3 className="text-lg font-semibold text-white group-hover:text-brand-teal transition uppercase tracking-wider">
                  {cat.name}
                </h3>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured Products */}
      {featuredProducts.length > 0 && (
        <section className="bg-brand-dark/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <h2 className="text-3xl font-bold text-white mb-8 text-center uppercase tracking-wide">
              Featured Products
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {featuredProducts.map((product) => {
                const totalStock = product.variants.reduce((s, v) => s + v.stock, 0);
                return (
                  <Link
                    key={product.id}
                    href={`/products/${product.slug}`}
                    className="group bg-brand-dark border border-brand-gray rounded overflow-hidden hover:border-brand-teal transition"
                  >
                    <div className="aspect-square bg-brand-gray flex items-center justify-center">
                      {product.images[0] ? (
                        <img
                          src={product.images[0].url}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-gray-600 text-4xl">🥋</span>
                      )}
                    </div>
                    <div className="p-4">
                      <p className="text-xs text-brand-teal uppercase tracking-wider mb-1 font-medium">
                        {product.category.name}
                      </p>
                      <h3 className="text-white font-semibold group-hover:text-brand-teal transition mb-2">
                        {product.name}
                      </h3>
                      <div className="flex items-center justify-between">
                        <p className="text-brand-teal font-bold text-lg">{formatCurrency(product.price)}</p>
                        {totalStock === 0 && (
                          <span className="text-xs text-red-400">Out of Stock</span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
            <div className="text-center mt-10">
              <Link
                href="/products"
                className="inline-block border-2 border-brand-teal text-brand-teal font-bold px-8 py-3 rounded hover:bg-brand-teal hover:text-brand-black transition uppercase tracking-wider"
              >
                View All Products
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Locations */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src="/about-banner.webp"
            alt="Ceconi BJJ Academy"
            fill
            className="object-cover"
          />
          <div className="absolute inset-0 bg-black/75" />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 relative">
          <h2 className="text-3xl font-bold text-white mb-8 text-center uppercase tracking-wide">
            Visit Our Academies
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {BRAND.locations.map((loc) => (
              <div
                key={loc.name}
                className="bg-black/50 backdrop-blur border border-white/10 rounded p-8 text-center"
              >
                <Image
                  src="/square-logo.svg"
                  alt="Ceconi BJJ"
                  width={60}
                  height={60}
                  className="mx-auto mb-4"
                />
                <h3 className="text-xl font-bold text-brand-teal mb-2 uppercase tracking-wider">{loc.name}</h3>
                <p className="text-gray-300">{loc.address}</p>
                <p className="text-brand-teal mt-3 font-medium">{BRAND.phone}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
