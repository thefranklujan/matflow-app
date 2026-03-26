import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import ProductForm from "@/components/admin/ProductForm";


export const dynamic = "force-dynamic";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      category: true,
      images: { orderBy: { sortOrder: "asc" } },
      variants: true,
    },
  });

  if (!product) return notFound();

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-8">Edit: {product.name}</h1>
      <ProductForm
        initialData={{
          id: product.id,
          name: product.name,
          description: product.description,
          price: product.price,
          compareAt: product.compareAt,
          categoryId: product.categoryId,
          featured: product.featured,
          active: product.active,
          variants: product.variants.map((v) => ({
            size: v.size,
            color: v.color || "",
            stock: v.stock,
          })),
          images: product.images.map((img) => ({
            url: img.url,
            alt: img.alt || "",
          })),
        }}
      />
    </div>
  );
}
