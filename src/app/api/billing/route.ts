export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createCheckoutSession, createPortalSession, hasLiveSubscription } from "@/lib/stripe";
import { isPlanKey, priceIdForPlan } from "@/lib/entitlements";

/**
 * Statuses under which the gym already has a Stripe subscription that could
 * bill. Creating a SECOND subscription via Checkout in any of these states is
 * the double-billing defect — always rejected with 409.
 *
 * Note: the app-level 30-day trial also uses "trialing" but has NO Stripe
 * subscription (stripePriceId is null) — that state MUST be allowed through to
 * Checkout, otherwise trials could never subscribe.
 */
const HAS_SUBSCRIPTION_STATUSES = new Set(["active", "past_due", "unpaid", "incomplete"]);

export async function POST(request: NextRequest) {
  // 1. Authentication/authorization — the ONLY thing that may produce a 401.
  let gymId: string;
  try {
    ({ gymId } = await requireAdmin());
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { action?: unknown; plan?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { action, plan } = body;

  const gym = await prisma.gym.findUnique({
    where: { id: gymId },
    select: { stripeCustomerId: true, subscriptionStatus: true, stripePriceId: true },
  });
  if (!gym) {
    return NextResponse.json({ error: "Gym not found" }, { status: 404 });
  }

  if (action === "checkout") {
    // The client only ever names a plan; the server maps it to an allowed
    // Stripe price. A client-supplied price ID is never trusted.
    if (!isPlanKey(plan)) {
      return NextResponse.json({ error: "Valid plan required (basic or pro)" }, { status: 400 });
    }
    const priceId = priceIdForPlan(plan);
    if (!priceId) {
      // Configuration problem, not a client mistake.
      return NextResponse.json(
        { error: "Subscriptions are not available right now. Please contact support.", code: "PRICE_NOT_CONFIGURED" },
        { status: 503 },
      );
    }

    // Duplicate-subscription prevention, layer 1: our own state. A gym whose
    // status says it has a subscription must use the billing portal to change
    // plans or fix payment — a new Checkout would create a second subscription.
    const status = gym.subscriptionStatus || "";
    const dbSaysSubscribed =
      HAS_SUBSCRIPTION_STATUSES.has(status) ||
      // Stripe-side trialing subscription (priceId written by webhook) — not
      // the app-level card-less trial, which has no priceId.
      (status === "trialing" && !!gym.stripePriceId);
    if (dbSaysSubscribed) {
      return NextResponse.json(
        {
          error: "This gym already has a subscription. Use Manage Subscription to change plans or update payment.",
          code: "SUBSCRIPTION_EXISTS",
        },
        { status: 409 },
      );
    }

    // Layer 2: ask Stripe directly. Webhook delivery can lag, so the DB can
    // say "canceled" while Stripe still has a live subscription.
    if (gym.stripeCustomerId) {
      try {
        if (await hasLiveSubscription(gym.stripeCustomerId)) {
          return NextResponse.json(
            {
              error: "This gym already has a subscription. Use Manage Subscription to change plans or update payment.",
              code: "SUBSCRIPTION_EXISTS",
            },
            { status: 409 },
          );
        }
      } catch {
        // Stripe unreachable: fail CLOSED for subscription creation. Creating
        // a possible duplicate is worse than asking the owner to retry.
        return NextResponse.json(
          { error: "Billing is temporarily unavailable. Please try again in a moment.", code: "STRIPE_UNAVAILABLE" },
          { status: 502 },
        );
      }
    }

    try {
      const session = await createCheckoutSession(gymId, gym.stripeCustomerId || null, priceId);
      if (!session.url) {
        return NextResponse.json(
          { error: "Billing is temporarily unavailable. Please try again in a moment.", code: "STRIPE_UNAVAILABLE" },
          { status: 502 },
        );
      }
      return NextResponse.json({ url: session.url });
    } catch {
      return NextResponse.json(
        { error: "Billing is temporarily unavailable. Please try again in a moment.", code: "STRIPE_UNAVAILABLE" },
        { status: 502 },
      );
    }
  }

  if (action === "portal") {
    if (!gym.stripeCustomerId) {
      return NextResponse.json(
        { error: "No billing account found for this gym yet.", code: "NO_CUSTOMER" },
        { status: 400 },
      );
    }
    try {
      const session = await createPortalSession(gym.stripeCustomerId);
      return NextResponse.json({ url: session.url });
    } catch {
      return NextResponse.json(
        { error: "Billing portal is temporarily unavailable. Please try again in a moment.", code: "STRIPE_UNAVAILABLE" },
        { status: 502 },
      );
    }
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
