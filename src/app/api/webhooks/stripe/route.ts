export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import type Stripe from "stripe";

export async function POST(request: NextRequest) {
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
      // Stripe's fulfillment guidance is explicit: check payment_status, and in
      // subscription mode the resulting subscription may be `incomplete`.
      // Delayed payment methods complete the session before funds settle and
      // report success later via async_payment_succeeded. So both events are
      // handled the same way, and neither one asserts "active" on its own.
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

        // Stripe's Subscription object is the source of truth for status. The
        // event is only the trigger to re-read it — event payloads are an
        // eventually-consistent snapshot and are not delivered in order.
        const sub = await getStripe().subscriptions.retrieve(session.subscription as string);
        const status = sub.status;

        // Clear the in-app trial only once the subscription actually supersedes
        // it. Clearing on an `incomplete` subscription would strand the owner
        // with neither a trial nor paid access.
        const supersedesTrial = status === "active" || status === "trialing";

        await prisma.gym.update({
          where: { id: gymId },
          data: {
            stripeCustomerId: session.customer as string,
            subscriptionStatus: status,
            stripePriceId: sub.items.data[0]?.price.id || null,
            ...(supersedesTrial ? { trialEndsAt: null } : {}),
          },
        });
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const gymId = subscription.metadata?.gymId;
        if (!gymId) break;

        await prisma.gym.update({
          where: { id: gymId },
          data: {
            subscriptionStatus: subscription.status,
            stripePriceId: subscription.items.data[0]?.price.id || null,
          },
        });
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const gymId = subscription.metadata?.gymId;
        if (!gymId) break;

        await prisma.gym.update({
          where: { id: gymId },
          data: { subscriptionStatus: "canceled" },
        });
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        if (!customerId) break;

        // A failed payment does not always mean past_due. On a subscription's
        // FIRST invoice Stripe keeps the subscription `incomplete`, and an
        // invoice may not belong to a subscription at all. Ask Stripe for the
        // real status rather than assuming one.
        const subscriptionId =
          typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id;
        if (!subscriptionId) break;

        const sub = await getStripe().subscriptions.retrieve(subscriptionId);
        await prisma.gym.updateMany({
          where: { stripeCustomerId: customerId },
          data: {
            subscriptionStatus: sub.status,
            stripePriceId: sub.items.data[0]?.price.id || null,
          },
        });
        break;
      }
    }
  } catch (error) {
    console.error("Stripe webhook error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
