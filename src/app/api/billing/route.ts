export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createCheckoutSession, createPortalSession } from "@/lib/stripe";

export async function POST(request: NextRequest) {
  try {
    const { gymId } = await requireAdmin();
    const body = await request.json();
    const { action, priceId } = body;

    const gym = await prisma.gym.findUnique({
      where: { id: gymId },
      select: { stripeCustomerId: true },
    });

    if (action === "checkout") {
      if (!priceId) {
        return NextResponse.json({ error: "Price ID required" }, { status: 400 });
      }
      const session = await createCheckoutSession(gymId, gym?.stripeCustomerId || null, priceId);
      return NextResponse.json({ url: session.url });
    }

    if (action === "portal") {
      if (!gym?.stripeCustomerId) {
        return NextResponse.json({ error: "No billing account found" }, { status: 400 });
      }
      const session = await createPortalSession(gym.stripeCustomerId);
      return NextResponse.json({ url: session.url });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
