/**
 * Single source of truth for owner subscription/plan entitlements.
 *
 * Everything about "what can this gym do" is derived here from the gym's
 * billing fields, server-side. UI guards (BillingGuard, auth-context) are for
 * presentation only — never rely on them for authorization.
 *
 * Price IDs live in env (they are identifiers, not secrets) so they can rotate
 * without a code change. A client NEVER chooses a Stripe price; it sends a plan
 * key and the server maps it through this allow-list.
 */

export type PlanKey = "basic" | "pro";

export const PLAN_KEYS: readonly PlanKey[] = ["basic", "pro"] as const;

export function isPlanKey(value: unknown): value is PlanKey {
  return value === "basic" || value === "pro";
}

/** Canonical subscription states we recognize. Anything else collapses to "unknown". */
export type SubState =
  | "trialing" // trial, not yet expired
  | "active" // paid subscription in good standing
  | "past_due" // payment failed, still recoverable
  | "canceled" // subscription ended
  | "expired" // trial ran out without subscribing
  | "unknown"; // no/legacy/unrecognized status

/** Active-member caps by plan. null = unlimited. */
const MEMBER_LIMITS: Record<PlanKey, number | null> = {
  basic: 100,
  pro: null,
};

export const BASIC_MEMBER_LIMIT = MEMBER_LIMITS.basic as number;

/**
 * Server-side plan -> Stripe price allow-list. Falls back to the NEXT_PUBLIC_
 * vars (same value, safe to read server-side) so existing deployments keep
 * working without an env change. Prefer the non-public STRIPE_*_PRICE_ID vars.
 */
function priceMap(): Record<PlanKey, string | undefined> {
  return {
    basic: process.env.STRIPE_BASIC_PRICE_ID || process.env.NEXT_PUBLIC_STRIPE_BASIC_PRICE_ID,
    pro: process.env.STRIPE_PRO_PRICE_ID || process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID,
  };
}

/** Resolve an allowed Stripe price ID for a plan key, or null if not configured. */
export function priceIdForPlan(plan: PlanKey): string | null {
  return priceMap()[plan] || null;
}

/** Reverse-map a Stripe price ID to a known plan. Unknown prices return null (never Pro). */
export function planForPriceId(priceId: string | null | undefined): PlanKey | null {
  if (!priceId) return null;
  const map = priceMap();
  if (map.basic && priceId === map.basic) return "basic";
  if (map.pro && priceId === map.pro) return "pro";
  return null;
}

export interface GymBillingFields {
  subscriptionStatus: string | null;
  trialEndsAt: Date | null;
  stripePriceId: string | null;
  approved: boolean;
}

export interface Entitlement {
  /** Precise, reportable state. */
  state: SubState;
  /** Effective plan (Basic during a valid trial). null when locked out or unknown. */
  plan: PlanKey | null;
  /** Whether the owner may use the dashboard beyond billing/settings/logout. */
  hasOwnerAccess: boolean;
  /** Whether the gym is blocked pending platform approval. */
  pendingApproval: boolean;
  /** Active-member cap while access is granted. null = unlimited. */
  memberLimit: number | null;
  /** Active subscription whose price is not in the allow-list — must be surfaced, never treated as Pro. */
  unknownPrice: boolean;
}

/**
 * Derive the full entitlement for a gym. `now` is injectable for testing.
 *
 * Lockout semantics intentionally match the pre-existing client behavior so
 * this can become the server-authoritative source without changing who is
 * locked out: pending approval, expired trial, canceled, and past_due are
 * locked; active and valid-trial are not.
 */
export function deriveEntitlement(gym: GymBillingFields, now: Date = new Date()): Entitlement {
  const status = gym.subscriptionStatus || "unknown";
  const trialValid = !!gym.trialEndsAt && gym.trialEndsAt.getTime() > now.getTime();
  const pendingApproval = gym.approved === false;

  const locked = (base: Omit<Entitlement, "pendingApproval" | "hasOwnerAccess">): Entitlement => ({
    ...base,
    pendingApproval,
    hasOwnerAccess: false,
  });

  if (status === "trialing") {
    if (!trialValid) {
      return locked({ state: "expired", plan: null, memberLimit: MEMBER_LIMITS.basic, unknownPrice: false });
    }
    return {
      state: "trialing",
      plan: "basic",
      hasOwnerAccess: !pendingApproval,
      pendingApproval,
      memberLimit: MEMBER_LIMITS.basic,
      unknownPrice: false,
    };
  }

  if (status === "active") {
    const plan = planForPriceId(gym.stripePriceId);
    if (plan) {
      return {
        state: "active",
        plan,
        hasOwnerAccess: !pendingApproval,
        pendingApproval,
        memberLimit: MEMBER_LIMITS[plan],
        unknownPrice: false,
      };
    }
    // Paying, but the price is not in our allow-list. Keep them working at Basic
    // level (never Pro) and flag it loudly for a human to reconcile.
    return {
      state: "active",
      plan: null,
      hasOwnerAccess: !pendingApproval,
      pendingApproval,
      memberLimit: MEMBER_LIMITS.basic,
      unknownPrice: true,
    };
  }

  // Locked/unknown states never get unlimited members — cap at Basic so a dead
  // subscription can't be exploited for unlimited seats. Access is separately
  // blocked by the owner-access guard.
  if (status === "past_due") {
    return locked({ state: "past_due", plan: planForPriceId(gym.stripePriceId), memberLimit: MEMBER_LIMITS.basic, unknownPrice: false });
  }
  if (status === "canceled") {
    return locked({ state: "canceled", plan: null, memberLimit: MEMBER_LIMITS.basic, unknownPrice: false });
  }

  return locked({ state: "unknown", plan: null, memberLimit: MEMBER_LIMITS.basic, unknownPrice: false });
}

/** Whether an entitlement satisfies a required minimum plan (pro > basic). */
export function planSatisfies(entitlement: Entitlement, required: PlanKey): boolean {
  if (!entitlement.hasOwnerAccess) return false;
  if (required === "basic") return true;
  // Pro required: only a genuinely Pro-priced active subscription qualifies.
  return entitlement.plan === "pro";
}
