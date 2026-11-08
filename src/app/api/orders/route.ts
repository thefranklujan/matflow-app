import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

/**
 * Commerce is switched off: it is not sold, takes no payment ("Payment
 * collected at pickup") and its storefront leaked across academies
 * (owner-features finding 7). Order creation answers 410 Gone. The previous
 * implementation, with its tenant-safe stock decrement, lives in git history
 * (before the Phase 0 hotfix) for the day commerce is built for real.
 */
export async function POST() {
  return NextResponse.json({ error: "The pro shop is not available." }, { status: 410 });
}
