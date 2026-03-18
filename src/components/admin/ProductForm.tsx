"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CATEGORY_SIZE_MAP, PRODUCT_COLORS } from "@/lib/constants";

interface Variant {
  size: string;
  color: string;
  stock: number;
}

interface ProductImage {
  url: string;
  alt: string;
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface ProductFormProps {
  initialData?: {
    id: string;
    name: string;
    description: string;
    price: number;
    compareAt: number | null;
    categoryId: string;
    featured: boolean;
    active: boolean;
    variants: Variant[];
    images: ProductImage[];
  };
}

export default function ProductForm({ initialData }: ProductFormProps) {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState(initialData?.name || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [price, setPrice] = useState(initialData?.price?.toString() || "");
  const [compareAt, setCompareAt] = useState(initialData?.compareAt?.toString() || "");
  const [categoryId, setCategoryId] = useState(initialData?.categoryId || "");
  const [featured, setFeatured] = useState(initialData?.featured || false);
  const [active, setActive] = useState(initialData?.active !== false);
  const [variants, setVariants] = useState<Variant[]>(initialData?.variants || []);
  const [images, setImages] = useState<ProductImage[]>(initialData?.images || []);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then(setCategories);
  }, []);

  const selectedCategory = categories.find((c) => c.id === categoryId);
  const availableSizes = selectedCategory
    ? CATEGORY_SIZE_MAP[selectedCategory.slug] || []
    : [];

  function addVariant() {
    setVariants([...variants, { size: "", color: "", stock: 0 }]);
  }

  function updateVariant(index: number, field: keyof Variant, value: string | number) {
    setVariants(variants.map((v, i) => (i === index ? { ...v, [field]: value } : v)));
  }

  function removeVariant(index: number) {
    setVariants(variants.filter((_, i) => i !== index));
  }

  function autoGenerateVariants() {
    if (availableSizes.length === 0) {
      setVariants([{ size: "One Size", color: "", stock: 0 }]);
      return;
    }
    const newVariants: Variant[] = [];
    for (const size of availableSizes) {
      newVariants.push({ size, color: "", stock: 0 });
    }
    setVariants(newVariants);
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;

    setUploading(true);
    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (res.ok) {
        const data = await res.json();
        setImages((prev) => [...prev, { url: data.url, alt: "" }]);
      }
    }
    setUploading(false);
    e.target.value = "";
  }

  function removeImage(index: number) {
    setImages(images.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    const url = initialData ? `/api/products/${initialData.id}` : "/api/products";
    const method = initialData ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description,
        price,
        compareAt: compareAt || null,
        categoryId,
        featured,
        active,
        variants,
        images,
      }),
    });

    setSaving(false);

    if (res.ok) {
      router.push("/admin/products");
      router.refresh();
    } else {
      const data = await res.json();
      setError(data.error || "Failed to save product");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-3xl">
      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Basic Info */}
      <div className="bg-brand-dark border border-brand-gray rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold text-white">Basic Information</h2>

        <div>
          <label className="block text-sm text-gray-300 mb-1">Product Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-2 bg-brand-black border border-brand-gray rounded-lg text-white focus:border-brand-teal focus:outline-none transition"
            required
          />
        </div>

        <div>
          <label className="block text-sm text-gray-300 mb-1">Description *</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full px-4 py-2 bg-brand-black border border-brand-gray rounded-lg text-white focus:border-brand-teal focus:outline-none transition resize-none"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-300 mb-1">Price ($) *</label>
            <input
              type="number"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full px-4 py-2 bg-brand-black border border-brand-gray rounded-lg text-white focus:border-brand-teal focus:outline-none transition"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1">Compare At Price ($)</label>
            <input
              type="number"
              step="0.01"
              value={compareAt}
              onChange={(e) => setCompareAt(e.target.value)}
              className="w-full px-4 py-2 bg-brand-black border border-brand-gray rounded-lg text-white focus:border-brand-teal focus:outline-none transition"
              placeholder="Original price for sale display"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-300 mb-1">Category *</label>
          <select
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              setVariants([]);
            }}
            className="w-full px-4 py-2 bg-brand-black border border-brand-gray rounded-lg text-white focus:border-brand-teal focus:outline-none transition"
            required
          >
            <option value="">Select a category</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={featured}
              onChange={(e) => setFeatured(e.target.checked)}
              className="rounded border-brand-gray"
            />
            Featured Product
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="rounded border-brand-gray"
            />
            Active (visible in store)
          </label>
        </div>
      </div>

      {/* Images */}
      <div className="bg-brand-dark border border-brand-gray rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold text-white">Images</h2>

        {images.length > 0 && (
          <div className="grid grid-cols-4 gap-3">
            {images.map((img, i) => (
              <div key={i} className="relative aspect-square bg-brand-gray rounded-lg overflow-hidden">
                <img src={img.url} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600"
                >
                  x
                </button>
              </div>
            ))}
          </div>
        )}

        <div>
          <label className="block w-full border-2 border-dashed border-brand-gray rounded-lg p-8 text-center cursor-pointer hover:border-brand-teal transition">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={handleImageUpload}
              className="hidden"
            />
            <p className="text-gray-400">{uploading ? "Uploading..." : "Click to upload images"}</p>
            <p className="text-xs text-gray-500 mt-1">JPG, PNG, or WebP. Max 5MB each.</p>
          </label>
        </div>
      </div>

      {/* Variants */}
      <div className="bg-brand-dark border border-brand-gray rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Variants (Size/Color/Stock)</h2>
          <div className="flex gap-2">
            {categoryId && (
              <button
                type="button"
                onClick={autoGenerateVariants}
                className="text-xs text-brand-teal border border-brand-teal px-3 py-1 rounded-lg hover:bg-brand-teal/10 transition"
              >
                Auto-generate sizes
              </button>
            )}
            <button
              type="button"
              onClick={addVariant}
              className="text-xs text-gray-300 border border-brand-gray px-3 py-1 rounded-lg hover:border-gray-500 transition"
            >
              + Add Variant
            </button>
          </div>
        </div>

        {variants.length === 0 && (
          <p className="text-sm text-gray-500">
            No variants yet. Select a category and click &quot;Auto-generate sizes&quot; or add them manually.
          </p>
        )}

        {variants.map((variant, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="flex-1">
              <input
                type="text"
                value={variant.size}
                onChange={(e) => updateVariant(i, "size", e.target.value)}
                placeholder="Size (e.g., M, A2)"
                className="w-full px-3 py-2 bg-brand-black border border-brand-gray rounded-lg text-white text-sm focus:border-brand-teal focus:outline-none"
                list={`sizes-${i}`}
              />
              {availableSizes.length > 0 && (
                <datalist id={`sizes-${i}`}>
                  {availableSizes.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              )}
            </div>
            <div className="flex-1">
              <select
                value={variant.color}
                onChange={(e) => updateVariant(i, "color", e.target.value)}
                className="w-full px-3 py-2 bg-brand-black border border-brand-gray rounded-lg text-white text-sm focus:border-brand-teal focus:outline-none"
              >
                <option value="">No color</option>
                {PRODUCT_COLORS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="w-24">
              <input
                type="number"
                value={variant.stock}
                onChange={(e) => updateVariant(i, "stock", parseInt(e.target.value) || 0)}
                placeholder="Stock"
                className="w-full px-3 py-2 bg-brand-black border border-brand-gray rounded-lg text-white text-sm focus:border-brand-teal focus:outline-none"
                min="0"
              />
            </div>
            <button
              type="button"
              onClick={() => removeVariant(i)}
              className="text-gray-500 hover:text-red-400 transition p-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      {/* Submit */}
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={saving}
          className="bg-brand-teal text-brand-black font-bold px-6 py-3 rounded-lg hover:bg-brand-teal/90 transition disabled:opacity-50"
        >
          {saving ? "Saving..." : initialData ? "Update Product" : "Create Product"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/products")}
          className="text-gray-400 hover:text-white transition"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
