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
    success_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/admin/billing?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/admin/billing?canceled=true`,
    metadata: { gymId },
    subscription_data: {
      trial_period_days: 14,
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
    return_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/admin/billing`,
  });
}
