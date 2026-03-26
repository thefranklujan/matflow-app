import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { gymId } = await requireAdmin();

    const { id } = await params;
    const { stock } = await req.json();

    // Verify variant belongs to a product owned by this gym
    const variant = await prisma.productVariant.findUnique({
      where: { id },
      include: { product: { select: { gymId: true } } },
    });

    if (!variant || variant.product.gymId !== gymId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const updated = await prisma.productVariant.update({
      where: { id },
      data: { stock: parseInt(stock) },
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
