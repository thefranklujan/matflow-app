export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  createCheckoutSession,
  createPortalSession,
  ensureCustomer,
  expireCheckoutSession,
  findOpenSubscriptionCheckout,
  hasLiveSubscription,
  isIdempotencyConflict,
} from "@/lib/stripe";
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

    // Everything below talks to Stripe and FAILS CLOSED: creating a possible
    // duplicate subscription is worse than asking the owner to retry.
    const stripeDown = NextResponse.json(
      { error: "Billing is temporarily unavailable. Please try again in a moment.", code: "STRIPE_UNAVAILABLE" },
      { status: 502 },
    );

    // Layer 2: exactly one Stripe Customer per gym (idempotent create), so all
    // subscription/session lookups have a single authoritative anchor.
    let customerId: string;
    try {
      customerId = await ensureCustomer(gymId, gym.stripeCustomerId);
      if (customerId !== gym.stripeCustomerId) {
        await prisma.gym.update({ where: { id: gymId }, data: { stripeCustomerId: customerId } });
      }
    } catch {
      return stripeDown;
    }

    // Layer 3: ask Stripe directly (webhook delivery can lag behind the DB).
    // Queried per live status, so many historical subscriptions cannot hide a
    // live one beyond a page limit.
    try {
      if (await hasLiveSubscription(customerId)) {
        return NextResponse.json(
          {
            error: "This gym already has a subscription. Use Manage Subscription to change plans or update payment.",
            code: "SUBSCRIPTION_EXISTS",
          },
          { status: 409 },
        );
      }
    } catch {
      return stripeDown;
    }

    // Layer 4: at most one OPEN Checkout Session per gym. Reuse it when it is
    // for the same plan (duplicate click / second tab); expire it first when
    // the owner picked a different plan.
    try {
      const open = await findOpenSubscriptionCheckout(customerId);
      if (open) {
        if (open.priceId === priceId && open.url) {
          return NextResponse.json({ url: open.url, reused: true });
        }
        await expireCheckoutSession(open.id);
      }
    } catch {
      return stripeDown;
    }

    // Layer 5: server-owned idempotency key, per gym and time-bucketed (30s).
    // Two simultaneous creates either return the SAME session (same plan) or
    // the second gets an idempotency conflict (different plan) -> 409. The
    // client never supplies a key, customer, price, or amount.
    const idempotencyKey = `sub-checkout:${gymId}:${Math.floor(Date.now() / 30_000)}`;
    try {
      const session = await createCheckoutSession(gymId, customerId, priceId, idempotencyKey);
      if (!session.url) return stripeDown;
      return NextResponse.json({ url: session.url });
    } catch (err) {
      if (isIdempotencyConflict(err)) {
        return NextResponse.json(
          { error: "Another checkout is already in progress for this gym. Please retry in a moment.", code: "CHECKOUT_IN_PROGRESS" },
          { status: 409 },
        );
      }
      return stripeDown;
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
