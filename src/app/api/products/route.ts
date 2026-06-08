import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";

export async function GET() {
  try {
    const { gymId } = await requireAdmin();

    const products = await prisma.product.findMany({
      where: { gymId },
      include: {
        category: true,
        images: { orderBy: { sortOrder: "asc" } },
        variants: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(products);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  let gymId: string;
  try {
    ({ gymId } = await requireAdmin());
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { name, description, price, compareAt, categoryId, featured, active, variants, images } = body;

    if (!name || !description || !price || !categoryId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Category must belong to this gym — never trust a client-supplied id that
    // could point at another tenant's category.
    const category = await prisma.category.findFirst({ where: { id: categoryId, gymId } });
    if (!category) {
      return NextResponse.json({ error: "Select a valid category" }, { status: 400 });
    }

    const slug = slugify(name);

    // Product slugs are unique per gym; surface a clear message instead of a 500.
    const slugTaken = await prisma.product.findFirst({ where: { gymId, slug } });
    if (slugTaken) {
      return NextResponse.json(
        { error: "A product with this name already exists" },
        { status: 409 }
      );
    }

    const product = await prisma.product.create({
      data: {
        gymId,
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
  } catch {
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 });
  }
}
