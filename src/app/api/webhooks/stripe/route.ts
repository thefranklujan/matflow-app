export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { ReconciliationConflict, reconcileSubscription } from "@/lib/subscription-reconcile";
import type Stripe from "stripe";

/**
 * Stripe webhook receiver.
 *
 * Two rules govern everything below.
 *
 * The event is a TRIGGER, not the truth. Stripe does not guarantee ordering and
 * describes event payloads as an eventually-consistent snapshot, so every
 * subscription-bearing event re-reads the Subscription and writes that.
 *
 * A customer id is not a tenant key. Ownership is resolved to exactly one
 * academy before any write; zero matches are acknowledged, and several matches
 * are refused so Stripe retries rather than us corrupting more rows.
 */
export async function POST(request: NextRequest) {
  // Raw body: Stripe requires it for signature verification, and any
  // re-parsing (request.json()) breaks the HMAC.
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      // A completed Checkout Session does NOT prove the payment succeeded.
      // Stripe's fulfillment guidance is explicit: in subscription mode the
      // resulting subscription may be `incomplete`, and delayed payment methods
      // complete the session before funds settle and report success later
      // through async_payment_succeeded. Both are handled identically, and
      // neither asserts "active" on its own.
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;
        const gymId = session.metadata?.gymId;
        if (!gymId) break;

        // Nothing to provision without a subscription; record the customer so
        // a later retry can still find it.
        if (!session.subscription) {
          if (session.customer) {
            await prisma.gym.update({
              where: { id: gymId },
              data: { stripeCustomerId: session.customer as string },
            });
          }
          break;
        }

        const subscriptionId =
          typeof session.subscription === "string" ? session.subscription : session.subscription.id;
        await reconcileSubscription(subscriptionId);
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        if (!subscription.id) break;
        // Deliberately ignores the status in this payload. A stale `updated`
        // arriving after a newer `deleted` would otherwise resurrect a dead
        // subscription; re-reading makes arrival order irrelevant.
        await reconcileSubscription(subscription.id);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;

        // A failed payment does not always mean past_due. On a subscription's
        // FIRST invoice Stripe keeps the subscription `incomplete`, and an
        // invoice may not belong to a subscription at all.
        const subscriptionId =
          typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id;
        if (!subscriptionId) break;

        await reconcileSubscription(subscriptionId);
        break;
      }
    }
  } catch (error) {
    if (error instanceof ReconciliationConflict) {
      // Sanitized: the message carries no Stripe ids or customer data.
      console.error("[StripeWebhook] refusing ambiguous write:", error.message);
      return NextResponse.json({ error: "Ownership conflict; retry" }, { status: 500 });
    }
    console.error("Stripe webhook error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
