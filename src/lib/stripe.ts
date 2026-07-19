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

/** True when a Stripe error is an idempotency conflict (same key, different params). */
export function isIdempotencyConflict(err: unknown): boolean {
  const e = err as { type?: string; raw?: { type?: string } } | null;
  return e?.type === "StripeIdempotencyError" || e?.raw?.type === "idempotency_error";
}

/**
 * Exactly one Stripe Customer per gym. The creation itself is idempotent via a
 * server-owned key derived from the gymId, so two concurrent "first checkout"
 * requests cannot create two customers (per Stripe idempotent-request
 * guidance). Callers persist the returned id on the Gym row.
 */
export async function ensureCustomer(gymId: string, existingCustomerId: string | null): Promise<string> {
  if (existingCustomerId) return existingCustomerId;
  const customer = await getStripe().customers.create(
    { metadata: { gymId } },
    { idempotencyKey: `customer:${gymId}` },
  );
  return customer.id;
}

/**
 * Whether the customer has any subscription in a state that could bill or
 * convert. Queried PER STATUS with limit 1 (not a single `status: "all"` page)
 * so a customer with many historical subscriptions cannot hide a live one
 * beyond the first page — no pagination blind spot.
 */
const LIVE_SUBSCRIPTION_STATUSES = [
  "active",
  "trialing",
  "past_due",
  "unpaid",
  "incomplete",
  "paused",
] as const;

export async function hasLiveSubscription(customerId: string): Promise<boolean> {
  const stripe = getStripe();
  for (const status of LIVE_SUBSCRIPTION_STATUSES) {
    const page = await stripe.subscriptions.list({
      customer: customerId,
      status: status as Stripe.SubscriptionListParams.Status,
      limit: 1,
    });
    if (page.data.length > 0) return true;
  }
  return false;
}

/** The customer's currently OPEN subscription Checkout Session, if any. */
export async function findOpenSubscriptionCheckout(
  customerId: string,
): Promise<{ id: string; url: string | null; priceId: string | null } | null> {
  const sessions = await getStripe().checkout.sessions.list({
    customer: customerId,
    status: "open",
    limit: 10,
    expand: ["data.line_items"],
  });
  const open = sessions.data.find((s) => s.mode === "subscription");
  if (!open) return null;
  return {
    id: open.id,
    url: open.url ?? null,
    priceId: open.line_items?.data?.[0]?.price?.id ?? null,
  };
}

export async function expireCheckoutSession(sessionId: string): Promise<void> {
  await getStripe().checkout.sessions.expire(sessionId);
}

/**
 * Create a subscription Checkout Session. The idempotency key is SERVER-OWNED
 * (never accepted from the client) and per-gym, so two simultaneous create
 * calls either return the same Session (identical params) or the second fails
 * with an idempotency conflict (different plan) — Stripe will not create two.
 */
export async function createCheckoutSession(
  gymId: string,
  customerId: string,
  priceId: string,
  idempotencyKey: string,
) {
  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/app/billing?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/app/billing?canceled=true`,
    customer: customerId,
    client_reference_id: gymId,
    metadata: { gymId },
    subscription_data: {
      metadata: { gymId },
    },
  };
  return getStripe().checkout.sessions.create(sessionParams, { idempotencyKey });
}

export async function createPortalSession(customerId: string) {
  return getStripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/app/billing`,
  });
}
