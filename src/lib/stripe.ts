import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-02-24.acacia",
    });
  }
  return _stripe;
}

export async function createCheckoutSession(gymId: string, customerId: string | null, priceId: string) {
  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/app/billing?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/app/billing?canceled=true`,
    metadata: { gymId },
    subscription_data: {
      metadata: { gymId },
    },
  };

  if (customerId) {
    sessionParams.customer = customerId;
  } else {
    sessionParams.customer_creation = "always";
  }

  return getStripe().checkout.sessions.create(sessionParams);
}

export async function createPortalSession(customerId: string) {
  return getStripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/app/billing`,
  });
}

/**
 * Belt-and-braces duplicate-subscription check against Stripe itself. The DB
 * state can lag webhook delivery, so before creating a NEW subscription via
 * Checkout we ask Stripe whether this customer already has a live one.
 * "Live" = any state that represents a subscription that exists and could
 * bill or convert (active, trialing, past_due, unpaid, incomplete, paused).
 */
export async function hasLiveSubscription(customerId: string): Promise<boolean> {
  const LIVE = new Set(["active", "trialing", "past_due", "unpaid", "incomplete", "paused"]);
  const subs = await getStripe().subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 10,
  });
  return subs.data.some((s) => LIVE.has(s.status));
}
