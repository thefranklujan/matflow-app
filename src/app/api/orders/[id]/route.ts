import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { gymId } = await requireAdmin();
    const { id } = await params;

    const order = await prisma.order.findFirst({
      where: { id, gymId },
      include: {
        items: {
          include: { product: true, variant: true },
        },
      },
    });
    if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(order);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { gymId } = await requireAdmin();

    const { id } = await params;
    const body = await req.json();

    // Verify order belongs to this gym
    const existing = await prisma.order.findFirst({ where: { id, gymId } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const order = await prisma.order.update({
      where: { id },
      data: { status: body.status },
      include: { items: { include: { product: true, variant: true } } },
    });

    return NextResponse.json(order);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
