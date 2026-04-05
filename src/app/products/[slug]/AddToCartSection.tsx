"use client";

import { useState } from "react";
import { useCart } from "@/context/CartContext";

interface Variant {
  id: string;
  size: string;
  color: string | null;
  stock: number;
}

interface Props {
  product: {
    id: string;
    name: string;
    slug: string;
    price: number;
    image: string | null;
  };
  variants: Variant[];
  sizes: string[];
  colors: string[];
}

export default function AddToCartSection({ product, variants, sizes, colors }: Props) {
  const { addItem } = useCart();
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [selectedColor, setSelectedColor] = useState<string>(colors[0] || "");
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const selectedVariant = variants.find(
    (v) =>
      v.size === selectedSize &&
      (colors.length === 0 || v.color === selectedColor)
  );

  const hasSizes = sizes.length > 0;
  const hasColors = colors.length > 0;

  function getStockForSize(size: string) {
    return variants
      .filter((v) => v.size === size && (!hasColors || v.color === selectedColor))
      .reduce((sum, v) => sum + v.stock, 0);
  }

  function handleAddToCart() {
    if (!selectedVariant) return;
    addItem({
      productId: product.id,
      variantId: selectedVariant.id,
      name: product.name,
      size: selectedVariant.size,
      color: selectedVariant.color,
      price: product.price,
      quantity,
      image: product.image,
      slug: product.slug,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  // For products without sizes (patches, etc.), auto-select the only variant
  const noSizeVariant = !hasSizes ? variants[0] : null;
  const canAdd = hasSizes ? selectedVariant && selectedVariant.stock > 0 : noSizeVariant && noSizeVariant.stock > 0;

  function handleAddNoSize() {
    if (!noSizeVariant) return;
    addItem({
      productId: product.id,
      variantId: noSizeVariant.id,
      name: product.name,
      size: noSizeVariant.size,
      color: noSizeVariant.color,
      price: product.price,
      quantity,
      image: product.image,
      slug: product.slug,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  return (
    <div className="space-y-6">
      {/* Color selector */}
      {hasColors && (
        <div>
          <label className="text-sm font-medium text-gray-300 mb-2 block">
            Color: <span className="text-white">{selectedColor}</span>
          </label>
          <div className="flex gap-2">
            {colors.map((color) => (
              <button
                key={color}
                onClick={() => {
                  setSelectedColor(color);
                  setSelectedSize("");
                }}
                className={`px-4 py-2 rounded-lg border text-sm transition ${
                  selectedColor === color
                    ? "border-brand-accent text-brand-accent bg-brand-accent/10"
                    : "border-brand-gray text-gray-300 hover:border-gray-500"
                }`}
              >
                {color}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Size selector */}
      {hasSizes && (
        <div>
          <label className="text-sm font-medium text-gray-300 mb-2 block">Size</label>
          <div className="flex flex-wrap gap-2">
            {sizes.map((size) => {
              const stock = getStockForSize(size);
              const isSelected = selectedSize === size;
              const outOfStock = stock === 0;

              return (
                <button
                  key={size}
                  onClick={() => !outOfStock && setSelectedSize(size)}
                  disabled={outOfStock}
                  className={`w-14 h-10 rounded-lg border text-sm font-medium transition ${
                    outOfStock
                      ? "border-brand-gray/50 text-gray-600 cursor-not-allowed line-through"
                      : isSelected
                      ? "border-brand-accent text-brand-accent bg-brand-accent/10"
                      : "border-brand-gray text-gray-300 hover:border-gray-500"
                  }`}
                >
                  {size}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Quantity */}
      <div>
        <label className="text-sm font-medium text-gray-300 mb-2 block">Quantity</label>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setQuantity(Math.max(1, quantity - 1))}
            className="w-10 h-10 rounded-lg border border-brand-gray text-gray-300 hover:border-gray-500 transition"
          >
            -
          </button>
          <span className="w-12 text-center text-white font-medium">{quantity}</span>
          <button
            onClick={() => setQuantity(quantity + 1)}
            className="w-10 h-10 rounded-lg border border-brand-gray text-gray-300 hover:border-gray-500 transition"
          >
            +
          </button>
        </div>
      </div>

      {/* Stock info */}
      {selectedVariant && (
        <p className="text-sm text-gray-400">
          {selectedVariant.stock > 0
            ? `${selectedVariant.stock} in stock`
            : "Out of stock"}
        </p>
      )}

      {/* Add to cart */}
      <button
        onClick={hasSizes ? handleAddToCart : handleAddNoSize}
        disabled={!canAdd}
        className={`w-full py-3 rounded-lg font-bold text-lg transition ${
          canAdd
            ? added
              ? "bg-green-500 text-white"
              : "bg-brand-accent text-brand-black hover:bg-brand-accent/90"
            : "bg-brand-gray text-gray-500 cursor-not-allowed"
        }`}
      >
        {added ? "Added to Cart!" : hasSizes && !selectedSize ? "Select a Size" : "Add to Cart"}
      </button>
    </div>
  );
}
