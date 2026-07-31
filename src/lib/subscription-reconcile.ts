/**
 * Subscription reconciliation.
 *
 * Stripe does not guarantee webhook ordering and warns that snapshot payloads
 * are an eventually-consistent view that "can be stale by the time you process
 * it". So a webhook is treated purely as a TRIGGER: we re-read the Subscription
 * from Stripe and write that, rather than trusting the state embedded in the
 * event we happened to receive.
 *
 * The second job here is tenant safety. A Stripe customer id is not a tenant
 * key. Writing by customer id with updateMany can silently mutate several
 * academies at once if the data is ever wrong, which is exactly the failure a
 * multi-tenant system must never have.
 */

import type Stripe from "stripe";
import { getStripe } from "./stripe";
import { prisma } from "./prisma";

export type ResolutionOutcome =
  /** Exactly one academy owns this subscription. Safe to write. */
  | "resolved"
  /** No academy matches. Acknowledge so Stripe stops retrying a lost cause. */
  | "no_match"
  /** Several academies match. Never write; ask Stripe to retry and raise a flag. */
  | "ambiguous";

export interface TenantResolution {
  outcome: ResolutionOutcome;
  gymId: string | null;
  /** Sanitized detail for logs. Never contains Stripe ids or customer data. */
  reason: string;
}

/**
 * Resolve the owning academy for a subscription.
 *
 * Preference order is deliberate: subscription metadata is written by us at
 * Checkout time and is the strongest signal. The customer id is only a
 * fallback, and it is required to match exactly one academy.
 */
export async function resolveGymForSubscription(
  subscription: Pick<Stripe.Subscription, "metadata" | "customer">,
): Promise<TenantResolution> {
  const metadataGymId = subscription.metadata?.gymId;

  if (metadataGymId) {
    const gym = await prisma.gym.findUnique({ where: { id: metadataGymId }, select: { id: true, stripeCustomerId: true } });
    if (!gym) {
      return { outcome: "no_match", gymId: null, reason: "subscription metadata names an academy that does not exist" };
    }

    // If the academy already has a DIFFERENT customer on file, something is
    // genuinely wrong. Refuse rather than guess which one is authoritative.
    const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
    if (gym.stripeCustomerId && customerId && gym.stripeCustomerId !== customerId) {
      return {
        outcome: "ambiguous",
        gymId: null,
        reason: "subscription metadata and stored customer disagree about ownership",
      };
    }
    return { outcome: "resolved", gymId: gym.id, reason: "resolved from subscription metadata" };
  }

  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
  if (!customerId) {
    return { outcome: "no_match", gymId: null, reason: "subscription carries neither gym metadata nor a customer" };
  }

  // Take 2: we only need to know whether the match is unique.
  const matches = await prisma.gym.findMany({ where: { stripeCustomerId: customerId }, select: { id: true }, take: 2 });
  if (matches.length === 0) {
    return { outcome: "no_match", gymId: null, reason: "no academy holds this billing customer" };
  }
  if (matches.length > 1) {
    return {
      outcome: "ambiguous",
      gymId: null,
      reason: "more than one academy holds the same billing customer",
    };
  }
  return { outcome: "resolved", gymId: matches[0].id, reason: "resolved from a unique stored customer" };
}

/** Raised when a write must not proceed but Stripe should retry the delivery. */
export class ReconciliationConflict extends Error {
  constructor(reason: string) {
    super(`Subscription reconciliation conflict: ${reason}`);
    this.name = "ReconciliationConflict";
  }
}

export interface ReconcileResult {
  outcome: ResolutionOutcome;
  gymId: string | null;
  status: string | null;
  reason: string;
}

/**
 * Re-read the subscription from Stripe and converge the academy onto it.
 *
 * Throwing on `ambiguous` is intentional: the caller turns it into a 500 so
 * Stripe retries, which buys time for a human to fix the data instead of
 * silently corrupting more of it.
 */
export async function reconcileSubscription(subscriptionId: string): Promise<ReconcileResult> {
  const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
  const resolution = await resolveGymForSubscription(subscription);

  if (resolution.outcome === "ambiguous") {
    throw new ReconciliationConflict(resolution.reason);
  }
  if (resolution.outcome === "no_match" || !resolution.gymId) {
    return { outcome: resolution.outcome, gymId: null, status: subscription.status, reason: resolution.reason };
  }

  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;

  // The price always comes from the subscription we just read, never from the
  // event payload, so a stale delivery cannot resurrect an old plan.
  const supersedesTrial = subscription.status === "active" || subscription.status === "trialing";

  await prisma.gym.update({
    where: { id: resolution.gymId },
    data: {
      subscriptionStatus: subscription.status,
      stripePriceId: subscription.items.data[0]?.price.id || null,
      ...(customerId ? { stripeCustomerId: customerId } : {}),
      ...(supersedesTrial ? { trialEndsAt: null } : {}),
    },
  });

  return {
    outcome: "resolved",
    gymId: resolution.gymId,
    status: subscription.status,
    reason: resolution.reason,
  };
}
