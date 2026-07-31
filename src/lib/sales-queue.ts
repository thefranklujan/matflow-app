/**
 * Founder sales / onboarding queue.
 *
 * Pure derivation from facts the database already holds — no new tracking, no
 * inference beyond what the records actually say. Time is injected.
 *
 * Truth rules enforced here:
 * - Synthetic platform gyms are excluded by the caller (SYNTHETIC_GYM_IDS).
 * - The owner is the FIRST member of the academy by createdAt. If that cannot
 *   be identified, the owner is Unknown — never an arbitrary member.
 * - A subscription whose price is not on the server allow-list is a
 *   reconciliation issue, not revenue.
 */

import { evaluateActivation, trialDaysRemaining, daysSince, type ActivationFacts } from "./activation";
import { planForPriceId, type PlanKey } from "./entitlements";

/** An academy left unactivated this long is a founder follow-up. */
export const STUCK_AFTER_DAYS = 3;
/** Window used for the "recent attendance" column. */
export const RECENT_ATTENDANCE_DAYS = 30;

export type SalesPriority =
  | "billing_issue"
  | "trial_ending_now"
  | "trial_ending_soon"
  | "stuck_unactivated"
  | "activated_no_usage"
  | "paid_active"
  | "none";

export const PRIORITY_ORDER: SalesPriority[] = [
  "billing_issue",
  "trial_ending_now",
  "trial_ending_soon",
  "stuck_unactivated",
  "activated_no_usage",
  "paid_active",
  "none",
];

export const PRIORITY_LABELS: Record<SalesPriority, string> = {
  billing_issue: "Billing needs attention",
  trial_ending_now: "Trial ends in 0-3 days",
  trial_ending_soon: "Trial ends in 4-7 days",
  stuck_unactivated: `Unactivated after ${STUCK_AFTER_DAYS} days`,
  activated_no_usage: "Set up but no check-ins yet",
  paid_active: "Paying academy",
  none: "No action needed",
};

export const PRIORITY_ACTIONS: Record<SalesPriority, string> = {
  billing_issue: "Contact the owner about payment before access lapses.",
  trial_ending_now: "Call today: convert the trial or extend deliberately.",
  trial_ending_soon: "Book the conversion conversation this week.",
  stuck_unactivated: "Offer a setup call — they signed up but never configured.",
  activated_no_usage: "Walk them through their first check-in.",
  paid_active: "Check in periodically; no immediate action.",
  none: "No action needed.",
};

/** Owner identity, or an explicit Unknown. */
export interface OwnerIdentity {
  name: string | null;
  email: string | null;
  phone: string | null;
  known: boolean;
}

export interface SalesQueueInput {
  gymId: string;
  gymName: string;
  gymSlug: string;
  createdAt: Date;
  subscriptionStatus: string;
  stripePriceId: string | null;
  trialEndsAt: Date | null;
  /** First member by createdAt, or null when it cannot be identified. */
  owner: { firstName: string | null; lastName: string | null; email: string | null; phone: string | null } | null;
  facts: ActivationFacts;
  recentAttendanceCount: number;
  lastActivity: { action: string; createdAt: Date } | null;
}

export interface SalesQueueRow {
  gymId: string;
  gymName: string;
  gymSlug: string;
  createdAt: Date;
  ageDays: number;
  owner: OwnerIdentity;
  subscriptionStatus: string;
  /** Allow-listed plan, or null when the price is unknown/absent. */
  plan: PlanKey | null;
  /** True when a paid-looking subscription carries a price we do not recognise. */
  needsPriceReconciliation: boolean;
  trialDaysRemaining: number | null;
  milestonesComplete: number;
  milestonesTotal: number;
  isActivated: boolean;
  hasLiveUsage: boolean;
  activeMembers: number;
  activeInstructors: number;
  activeClasses: number;
  recentAttendanceCount: number;
  lastActivityAction: string | null;
  lastActivityAt: Date | null;
  priority: SalesPriority;
  recommendedAction: string;
}

function identifyOwner(owner: SalesQueueInput["owner"]): OwnerIdentity {
  if (!owner || (!owner.email && !owner.firstName && !owner.lastName)) {
    return { name: null, email: null, phone: null, known: false };
  }
  const name = [owner.firstName, owner.lastName].filter(Boolean).join(" ").trim();
  return {
    name: name || null,
    email: owner.email,
    phone: owner.phone,
    known: Boolean(owner.email || name),
  };
}

/** Statuses that mean money is expected but not currently flowing. */
const BILLING_TROUBLE = new Set(["past_due", "unpaid", "incomplete", "incomplete_expired", "paused"]);

export function buildSalesQueueRow(input: SalesQueueInput, now: Date): SalesQueueRow {
  const activation = evaluateActivation(input.facts);
  const plan = planForPriceId(input.stripePriceId);
  const isActiveSubscription = input.subscriptionStatus === "active";
  const needsPriceReconciliation = isActiveSubscription && plan === null;
  const daysLeft = trialDaysRemaining(input.trialEndsAt, now);
  const ageDays = daysSince(input.createdAt, now);

  let priority: SalesPriority = "none";
  if (BILLING_TROUBLE.has(input.subscriptionStatus) || needsPriceReconciliation) {
    priority = "billing_issue";
  } else if (input.subscriptionStatus === "trialing" && daysLeft !== null && daysLeft <= 3) {
    priority = "trial_ending_now";
  } else if (input.subscriptionStatus === "trialing" && daysLeft !== null && daysLeft <= 7) {
    priority = "trial_ending_soon";
  } else if (!activation.isActivated && ageDays >= STUCK_AFTER_DAYS) {
    priority = "stuck_unactivated";
  } else if (activation.isActivated && !activation.hasLiveUsage) {
    priority = "activated_no_usage";
  } else if (isActiveSubscription && plan !== null) {
    priority = "paid_active";
  }

  return {
    gymId: input.gymId,
    gymName: input.gymName,
    gymSlug: input.gymSlug,
    createdAt: input.createdAt,
    ageDays,
    owner: identifyOwner(input.owner),
    subscriptionStatus: input.subscriptionStatus,
    plan,
    needsPriceReconciliation,
    trialDaysRemaining: daysLeft,
    milestonesComplete: activation.completedCount,
    milestonesTotal: activation.totalCount,
    isActivated: activation.isActivated,
    hasLiveUsage: activation.hasLiveUsage,
    activeMembers: input.facts.activeMemberCount,
    activeInstructors: input.facts.activeInstructorCount,
    activeClasses: input.facts.activeScheduleCount,
    recentAttendanceCount: input.recentAttendanceCount,
    lastActivityAction: input.lastActivity?.action ?? null,
    lastActivityAt: input.lastActivity?.createdAt ?? null,
    priority,
    recommendedAction: PRIORITY_ACTIONS[priority],
  };
}

export type SortKey = "urgency" | "trialEnd" | "created" | "lastActivity";

export function sortSalesQueue(rows: SalesQueueRow[], key: SortKey): SalesQueueRow[] {
  const copy = [...rows];
  switch (key) {
    case "urgency":
      return copy.sort((a, b) => {
        const diff = PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority);
        if (diff !== 0) return diff;
        // Within a bucket, the soonest trial end first, then the newest academy.
        const at = a.trialDaysRemaining ?? Number.POSITIVE_INFINITY;
        const bt = b.trialDaysRemaining ?? Number.POSITIVE_INFINITY;
        if (at !== bt) return at - bt;
        return b.createdAt.getTime() - a.createdAt.getTime();
      });
    case "trialEnd":
      return copy.sort(
        (a, b) =>
          (a.trialDaysRemaining ?? Number.POSITIVE_INFINITY) - (b.trialDaysRemaining ?? Number.POSITIVE_INFINITY),
      );
    case "created":
      return copy.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    case "lastActivity":
      return copy.sort((a, b) => (b.lastActivityAt?.getTime() ?? 0) - (a.lastActivityAt?.getTime() ?? 0));
  }
}

export interface QueueFilters {
  search?: string;
  priority?: SalesPriority | "all";
  activation?: "all" | "activated" | "not_activated";
  billing?: "all" | "trialing" | "active" | "trouble";
  plan?: "all" | PlanKey | "unknown";
}

export function filterSalesQueue(rows: SalesQueueRow[], filters: QueueFilters): SalesQueueRow[] {
  const term = filters.search?.trim().toLowerCase() ?? "";
  return rows.filter((row) => {
    if (term) {
      const haystack = [row.gymName, row.gymSlug, row.owner.name ?? "", row.owner.email ?? ""].join(" ").toLowerCase();
      if (!haystack.includes(term)) return false;
    }
    if (filters.priority && filters.priority !== "all" && row.priority !== filters.priority) return false;
    if (filters.activation === "activated" && !row.isActivated) return false;
    if (filters.activation === "not_activated" && row.isActivated) return false;
    if (filters.billing === "trialing" && row.subscriptionStatus !== "trialing") return false;
    if (filters.billing === "active" && row.subscriptionStatus !== "active") return false;
    if (filters.billing === "trouble" && !(BILLING_TROUBLE.has(row.subscriptionStatus) || row.needsPriceReconciliation)) {
      return false;
    }
    if (filters.plan && filters.plan !== "all") {
      if (filters.plan === "unknown" ? row.plan !== null : row.plan !== filters.plan) return false;
    }
    return true;
  });
}

/** Metrics this queue deliberately cannot report yet. */
export const QUEUE_UNAVAILABLE = [
  { metric: "Trial-to-paid conversion rate", status: "Missing", why: "No lifecycle/cohort instrumentation exists yet." },
  { metric: "Retention / churn", status: "Missing", why: "No cohort table; subscription history is not stored locally." },
  { metric: "Stripe cash, fees, refunds, taxes, disputes", status: "Access Needed", why: "Requires Stripe API access, not in this app's data." },
  { metric: "App Store analytics", status: "Access Needed", why: "Separate system (student app), not owner sales data." },
] as const;
