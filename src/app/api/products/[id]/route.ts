import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const product = await prisma.product.findUnique({
    where: { id },
    include: { category: true, images: { orderBy: { sortOrder: "asc" } }, variants: true },
  });
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(product);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { name, description, price, compareAt, categoryId, featured, active, variants, images } = body;

  // Delete existing variants and images, recreate them
  await prisma.productVariant.deleteMany({ where: { productId: id } });
  await prisma.productImage.deleteMany({ where: { productId: id } });

  const product = await prisma.product.update({
    where: { id },
    data: {
      name,
      slug: slugify(name),
      description,
      price: parseFloat(price),
      compareAt: compareAt ? parseFloat(compareAt) : null,
      categoryId,
      featured: featured || false,
      active: active !== false,
      variants: {
        create: (variants || []).map((v: any) => ({
          size: v.size,
          color: v.color || null,
          stock: parseInt(v.stock) || 0,
          sku: v.sku || null,
        })),
      },
      images: {
        create: (images || []).map((img: any, i: number) => ({
          url: img.url,
          alt: img.alt || null,
          sortOrder: i,
        })),
      },
    },
    include: { category: true, variants: true, images: true },
  });

  return NextResponse.json(product);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await prisma.product.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
