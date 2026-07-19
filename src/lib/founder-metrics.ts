import { deriveEntitlement, priceIdForPlan } from "@/lib/entitlements";

/**
 * Founder dashboard metrics — existing records only, no schema changes.
 *
 * Money rules (never violated):
 * - Basic/Pro are derived ONLY from the server price-ID allow-list.
 * - Gross MRR = basicCount x $49 + proCount x $99, labeled an ESTIMATE.
 * - Unknown-price actives, legacy free, canceled, and expired gyms are NEVER
 *   counted as revenue; they surface as reconciliation counts instead.
 * - Synthetic platform gyms are excluded upstream by id; demo/review gyms are
 *   NOT auto-excluded (they appear in their real states — documented rule).
 */

export const SYNTHETIC_GYM_IDS = ["platform-owner-gym", "platform-admin-gym"];

/** Documented rule: an APPROVED gym whose owner currently has access "needs
 *  onboarding help" when it still has at most one ACTIVE member 3+ days after
 *  signup. Canceled/expired/locked/unapproved gyms are a billing or approval
 *  problem, not an onboarding one — they never appear in this list. */
export const STUCK_DAYS = 3;

/** Classes whose owners currently have working access to the product. */
const ACCESS_CLASSES: FounderGymClass[] = ["basic", "pro", "trialing_valid", "legacy_free"];

export interface FounderGymRow {
  id: string;
  name: string;
  subscriptionStatus: string;
  stripePriceId: string | null;
  trialEndsAt: Date | null;
  approved: boolean;
  createdAt: Date;
  /** ACTIVE members only — callers must pass a filtered count. */
  activeMemberCount: number;
}

export type FounderGymClass =
  | "basic" // active + Basic price (allow-list)
  | "pro" // active + Pro price (allow-list)
  | "active_unknown_price" // active but price not in allow-list — reconcile!
  | "trialing_valid"
  | "trial_expired"
  | "past_due" // incl. unpaid/incomplete/paused
  | "canceled"
  | "legacy_free"
  | "unknown";

export interface FounderBreakdown {
  totalReal: number;
  counts: Record<FounderGymClass, number>;
  /** Gross monthly estimate from allow-listed plans ONLY (USD). */
  grossMrrEstimateUsd: number;
  /** Rows excluded from revenue that a founder must reconcile by hand. */
  reconciliation: { gymId: string; name: string; reason: FounderGymClass }[];
  trialsEnding7d: { gymId: string; name: string; trialEndsAt: Date; daysLeft: number }[];
  needsOnboardingHelp: { gymId: string; name: string; createdAt: Date }[];
  /** Directly measurable: academies with 2+ ACTIVE members. (The schema cannot
   *  prove which member is "the owner", so no owner-based claim is made.) */
  activatedGyms: number;
}

export const PLAN_PRICES_USD = { basic: 49, pro: 99 } as const;

export function classifyGym(row: FounderGymRow, now: Date): FounderGymClass {
  const e = deriveEntitlement(
    { subscriptionStatus: row.subscriptionStatus, trialEndsAt: row.trialEndsAt, stripePriceId: row.stripePriceId, approved: row.approved },
    now,
  );
  switch (e.state) {
    case "active":
      if (e.plan === "pro") return "pro";
      if (e.plan === "basic") return "basic";
      return "active_unknown_price";
    case "trialing":
      return "trialing_valid";
    case "expired":
      return "trial_expired";
    case "past_due":
      return "past_due";
    case "canceled":
      return "canceled";
    case "legacy_free":
      return "legacy_free";
    default:
      return "unknown";
  }
}

export function buildFounderBreakdown(rows: FounderGymRow[], now: Date): FounderBreakdown {
  // Defense in depth: callers already filter synthetic ids in the query.
  const real = rows.filter((r) => !SYNTHETIC_GYM_IDS.includes(r.id));

  const counts: Record<FounderGymClass, number> = {
    basic: 0, pro: 0, active_unknown_price: 0, trialing_valid: 0,
    trial_expired: 0, past_due: 0, canceled: 0, legacy_free: 0, unknown: 0,
  };
  const reconciliation: FounderBreakdown["reconciliation"] = [];
  const trialsEnding7d: FounderBreakdown["trialsEnding7d"] = [];
  const needsOnboardingHelp: FounderBreakdown["needsOnboardingHelp"] = [];
  let activatedGyms = 0;

  const in7d = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
  const stuckCutoff = new Date(now.getTime() - STUCK_DAYS * 24 * 3600 * 1000);

  for (const row of real) {
    const cls = classifyGym(row, now);
    counts[cls]++;
    if (cls === "active_unknown_price" || cls === "legacy_free" || cls === "unknown") {
      reconciliation.push({ gymId: row.id, name: row.name, reason: cls });
    }
    if (cls === "trialing_valid" && row.trialEndsAt && row.trialEndsAt <= in7d) {
      trialsEnding7d.push({
        gymId: row.id,
        name: row.name,
        trialEndsAt: row.trialEndsAt,
        daysLeft: Math.max(0, Math.ceil((row.trialEndsAt.getTime() - now.getTime()) / (24 * 3600 * 1000))),
      });
    }
    const hasAccess = row.approved && ACCESS_CLASSES.includes(cls);
    if (hasAccess && row.activeMemberCount <= 1 && row.createdAt < stuckCutoff) {
      needsOnboardingHelp.push({ gymId: row.id, name: row.name, createdAt: row.createdAt });
    }
    if (row.activeMemberCount >= 2) activatedGyms++;
  }

  trialsEnding7d.sort((a, b) => a.trialEndsAt.getTime() - b.trialEndsAt.getTime());

  return {
    totalReal: real.length,
    counts,
    grossMrrEstimateUsd: counts.basic * PLAN_PRICES_USD.basic + counts.pro * PLAN_PRICES_USD.pro,
    reconciliation,
    trialsEnding7d,
    needsOnboardingHelp,
    activatedGyms,
  };
}

/** True when BOTH allow-list price ids are configured — without them every
 *  active gym is "unknown price" and the MRR estimate is $0 by design. */
export function priceAllowListConfigured(): boolean {
  return !!priceIdForPlan("basic") && !!priceIdForPlan("pro");
}

/** Metrics with no data source yet — rendered as explicit gaps, never faked. */
export const UNAVAILABLE_METRICS = [
  { label: "Trial-to-paid conversion", status: "Missing" as const, needs: "billing event history (PACKET-2/analytics migration)" },
  { label: "Subscription churn", status: "Missing" as const, needs: "billing event history" },
  { label: "Cohort retention", status: "Missing" as const, needs: "activity event pipeline" },
  { label: "Refunds & disputes", status: "Access Needed" as const, needs: "Stripe dashboard/API" },
  { label: "Net revenue (fees, taxes)", status: "Access Needed" as const, needs: "Stripe balance data" },
  { label: "Acquisition source", status: "Missing" as const, needs: "attribution capture" },
  { label: "App Store funnel", status: "Access Needed" as const, needs: "App Store Connect API" },
  { label: "Website→signup attribution", status: "Missing" as const, needs: "attribution capture" },
];
