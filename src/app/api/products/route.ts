import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";

export async function GET() {
  const products = await prisma.product.findMany({
    include: {
      category: true,
      images: { orderBy: { sortOrder: "asc" } },
      variants: true,
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(products);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, description, price, compareAt, categoryId, featured, active, variants, images } = body;

  if (!name || !description || !price || !categoryId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const slug = slugify(name);

  const product = await prisma.product.create({
    data: {
      name,
      slug,
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

  return NextResponse.json(product, { status: 201 });
}
