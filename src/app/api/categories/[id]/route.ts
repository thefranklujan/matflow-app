import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";
import { ensureUncategorized } from "@/lib/categories";

const UNCATEGORIZED_SLUG = "uncategorized";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let gymId: string;
  try {
    ({ gymId } = await requireAdmin());
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const category = await prisma.category.findFirst({ where: { id, gymId } });
    if (!category) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (category.slug === UNCATEGORIZED_SLUG) {
      return NextResponse.json(
        { error: "The Uncategorized category can't be renamed." },
        { status: 400 }
      );
    }

    const body = await req.json();
    const data: { name?: string; slug?: string; sortOrder?: number } = {};

    if (typeof body.name === "string") {
      const name = body.name.trim();
      if (!name) {
        return NextResponse.json({ error: "Category name is required" }, { status: 400 });
      }
      const slug = slugify(name);
      if (!slug) {
        return NextResponse.json({ error: "Category name must contain letters or numbers" }, { status: 400 });
      }
      // Don't collide with another category in this gym.
      const clash = await prisma.category.findFirst({
        where: { gymId, slug, id: { not: id } },
      });
      if (clash) {
        return NextResponse.json({ error: "A category with this name already exists" }, { status: 409 });
      }
      data.name = name;
      data.slug = slug;
    }

    if (typeof body.sortOrder === "number") {
      data.sortOrder = body.sortOrder;
    }

    const updated = await prisma.category.update({ where: { id }, data });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Failed to update category" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let gymId: string;
  try {
    ({ gymId } = await requireAdmin());
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const category = await prisma.category.findFirst({
      where: { id, gymId },
      include: { _count: { select: { products: true } } },
    });
    if (!category) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (category.slug === UNCATEGORIZED_SLUG) {
      return NextResponse.json(
        { error: "The Uncategorized category can't be deleted." },
        { status: 400 }
      );
    }

    // Product.categoryId is required, so any products in this category must be
    // moved before we can delete it. Reassign them to the gym's Uncategorized
    // bucket (created on demand) inside a transaction so we never orphan a row.
    if (category._count.products > 0) {
      const fallback = await ensureUncategorized(gymId);
      await prisma.$transaction([
        prisma.product.updateMany({
          where: { gymId, categoryId: id },
          data: { categoryId: fallback.id },
        }),
        prisma.category.delete({ where: { id } }),
      ]);
      return NextResponse.json({ success: true, reassignedTo: fallback.id });
    }

    await prisma.category.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete category" }, { status: 500 });
  }
}
