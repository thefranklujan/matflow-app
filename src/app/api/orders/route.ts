import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const orders = await prisma.order.findMany({
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
}

export async function POST(req: NextRequest) {
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

  return NextResponse.json(order, { status: 201 });
}
