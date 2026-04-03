import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, getAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendOrderConfirmation } from "@/lib/email";

export async function GET() {
  try {
    const { gymId } = await requireAdmin();

    const orders = await prisma.order.findMany({
      where: { gymId },
      include: {
        items: {
          include: {
            product: true,
            variant: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(orders);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await getAuthContext();
    const gymId = ctx.gymId;
    if (!gymId) {
      return NextResponse.json({ error: "No gym context" }, { status: 400 });
    }

    const body = await req.json();
    const { customerName, customerEmail, customerPhone, shippingAddress, notes, items } = body;

    if (!customerName || !customerEmail || !items?.length) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const subtotal = items.reduce(
      (sum: number, item: any) => sum + item.unitPrice * item.quantity,
      0
    );

    const order = await prisma.order.create({
      data: {
        gymId,
        customerName,
        customerEmail,
        customerPhone: customerPhone || null,
        shippingAddress: shippingAddress || null,
        notes: notes || null,
        subtotal,
        total: subtotal,
        items: {
          create: items.map((item: any) => ({
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          })),
        },
      },
      include: { items: true },
    });

    const gym = await prisma.gym.findUnique({ where: { id: gymId }, select: { name: true } });
    sendOrderConfirmation(customerEmail, customerName, order.id, subtotal, gym?.name || "Your Gym");

    return NextResponse.json(order, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
