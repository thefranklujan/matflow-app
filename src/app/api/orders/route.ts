import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, getAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendOrderConfirmation } from "@/lib/email";
import { logActivity } from "@/lib/activity-log";

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

    if (!customerName || !customerEmail || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Validate each requested line item. Client-supplied prices are never
    // trusted; quantities must be positive integers.
    type LineReq = { productId: string; variantId: string; quantity: number };
    const requested: LineReq[] = [];
    for (const raw of items) {
      const productId = typeof raw?.productId === "string" ? raw.productId : null;
      const variantId = typeof raw?.variantId === "string" ? raw.variantId : null;
      // Strict: quantity must be an actual JSON number (no string coercion).
      const quantity = typeof raw?.quantity === "number" ? raw.quantity : NaN;
      if (!productId || !variantId || !Number.isInteger(quantity) || quantity < 1) {
        return NextResponse.json({ error: "Invalid line item" }, { status: 400 });
      }
      requested.push({ productId, variantId, quantity });
    }

    // Resolve variants for THIS gym only. Any id that does not resolve to an
    // active product owned by the authenticated gym is a cross-tenant or
    // invalid reference and rejects the whole order.
    const variantIds = [...new Set(requested.map((r) => r.variantId))];
    const variants = await prisma.productVariant.findMany({
      where: { id: { in: variantIds }, product: { gymId, active: true } },
      select: { id: true, stock: true, productId: true, product: { select: { id: true, price: true } } },
    });
    const variantById = new Map(variants.map((v) => [v.id, v]));

    // Aggregate quantities per variant so split lines cannot dodge stock checks.
    const qtyByVariant = new Map<string, number>();
    for (const r of requested) {
      const v = variantById.get(r.variantId);
      if (!v || v.productId !== r.productId) {
        return NextResponse.json({ error: "One or more items are unavailable" }, { status: 400 });
      }
      qtyByVariant.set(r.variantId, (qtyByVariant.get(r.variantId) || 0) + r.quantity);
    }
    for (const [variantId, qty] of qtyByVariant) {
      if (variantById.get(variantId)!.stock < qty) {
        return NextResponse.json({ error: "One or more items are out of stock" }, { status: 409 });
      }
    }

    // Server-derived prices and subtotal.
    const lineItems = requested.map((r) => ({
      productId: r.productId,
      variantId: r.variantId,
      quantity: r.quantity,
      unitPrice: variantById.get(r.variantId)!.product.price,
    }));
    const subtotal = lineItems.reduce((sum, li) => sum + li.unitPrice * li.quantity, 0);

    // Create the order and decrement stock atomically. The decrement is
    // CONDITIONAL (stock >= qty in the WHERE) so two concurrent orders cannot
    // both take the last unit: the row lock serializes the updates and the
    // loser's WHERE no longer matches, rolling its whole order back. The
    // pre-transaction stock read above is only a fast-path courtesy check.
    class OutOfStockError extends Error {}
    let order;
    try {
      order = await prisma.$transaction(async (tx) => {
        for (const [variantId, qty] of qtyByVariant) {
          const res = await tx.productVariant.updateMany({
            where: { id: variantId, stock: { gte: qty } },
            data: { stock: { decrement: qty } },
          });
          if (res.count !== 1) throw new OutOfStockError();
        }
        return tx.order.create({
          data: {
            gymId,
            customerName,
            customerEmail,
            customerPhone: customerPhone || null,
            shippingAddress: shippingAddress || null,
            notes: notes || null,
            subtotal,
            total: subtotal,
            items: { create: lineItems },
          },
          include: { items: true },
        });
      });
    } catch (err) {
      if (err instanceof OutOfStockError) {
        return NextResponse.json({ error: "One or more items are out of stock" }, { status: 409 });
      }
      throw err;
    }

    const gym = await prisma.gym.findUnique({ where: { id: gymId }, select: { name: true } });
    sendOrderConfirmation(customerEmail, customerName, order.id, subtotal, gym?.name || "Your Gym");
    logActivity({ gymId, action: "order_placed", actorName: customerName, targetId: order.id, meta: { total: subtotal, itemCount: lineItems.length } });

    return NextResponse.json(order, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
