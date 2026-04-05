import Link from "next/link";
import { formatCurrency } from "@/lib/utils";

interface ProductCardProps {
  product: {
    id: string;
    name: string;
    slug: string;
    price: number;
    compareAt: number | null;
    category: { name: string };
    images: { url: string; alt: string | null }[];
    variants: { stock: number }[];
  };
}

export default function ProductCard({ product }: ProductCardProps) {
  const totalStock = product.variants.reduce((s, v) => s + v.stock, 0);
  const firstImage = product.images[0];

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group bg-brand-dark border border-brand-gray rounded-lg overflow-hidden hover:border-brand-accent transition"
    >
      <div className="aspect-square bg-brand-gray flex items-center justify-center relative">
        {firstImage ? (
          <img
            src={firstImage.url}
            alt={firstImage.alt || product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-gray-600 text-4xl">🥋</span>
        )}
        {product.compareAt && product.compareAt > product.price && (
          <span className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded">
            SALE
          </span>
        )}
      </div>
      <div className="p-4">
        <p className="text-xs text-brand-accent uppercase tracking-wider mb-1">
          {product.category.name}
        </p>
        <h3 className="text-white font-semibold group-hover:text-brand-accent transition mb-2 line-clamp-2">
          {product.name}
        </h3>
        <div className="flex items-center gap-2">
          <p className="text-brand-accent font-bold">{formatCurrency(product.price)}</p>
          {product.compareAt && product.compareAt > product.price && (
            <p className="text-gray-500 text-sm line-through">
              {formatCurrency(product.compareAt)}
            </p>
          )}
        </div>
        {totalStock === 0 && (
          <p className="text-xs text-red-400 mt-1">Out of Stock</p>
        )}
      </div>
    </Link>
  );
}
