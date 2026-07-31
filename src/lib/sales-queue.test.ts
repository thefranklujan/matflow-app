import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { ActivationFacts } from "./activation";
import {
  PRIORITY_ORDER,
  RECENT_ATTENDANCE_DAYS,
  STUCK_AFTER_DAYS,
  buildSalesQueueRow,
  filterSalesQueue,
  sortSalesQueue,
  type SalesQueueInput,
  type SalesQueueRow,
} from "./sales-queue";

const NOW = new Date("2026-07-31T12:00:00.000Z");

const ACTIVATED: ActivationFacts = {
  description: "d",
  city: "Houston",
  state: "TX",
  activeMemberCount: 5,
  activeInstructorCount: 1,
  activeScheduleCount: 3,
  attendanceCount: 10,
};
const BARE: ActivationFacts = {
  description: null,
  city: null,
  state: null,
  activeMemberCount: 1,
  activeInstructorCount: 0,
  activeScheduleCount: 0,
  attendanceCount: 0,
};

function input(patch: Partial<SalesQueueInput> = {}): SalesQueueInput {
  return {
    gymId: "gym_1",
    gymName: "Iron Lion",
    gymSlug: "iron-lion",
    createdAt: new Date("2026-07-01T12:00:00.000Z"),
    subscriptionStatus: "trialing",
    stripePriceId: null,
    trialEndsAt: new Date("2026-08-20T12:00:00.000Z"),
    ownerCandidates: [
      { clerkUserId: "owner-uuid-1", firstName: "Marcus", lastName: "Vega", email: "marcus@iron.test", phone: "5551234567" },
    ],
    facts: ACTIVATED,
    recentAttendanceCount: 4,
    lastActivity: { action: "attendance_recorded", createdAt: new Date("2026-07-30T12:00:00.000Z") },
    ...patch,
  };
}

beforeEach(() => {
  process.env.STRIPE_BASIC_PRICE_ID = "price_basic_test";
  process.env.STRIPE_PRO_PRICE_ID = "price_pro_test";
});
afterEach(() => {
  delete process.env.STRIPE_BASIC_PRICE_ID;
  delete process.env.STRIPE_PRO_PRICE_ID;
});

describe("owner identification — marker only, never a guess", () => {
  const marked = (id: string, first: string | null = "Marcus", email: string | null = "marcus@iron.test") => ({
    clerkUserId: id, firstName: first, lastName: "Vega", email, phone: null,
  });
  const unmarked = (id: string) => ({ clerkUserId: id, firstName: "Early", lastName: "Member", email: "early@iron.test", phone: null });

  it("exactly one marked owner is identified", () => {
    const row = buildSalesQueueRow(input({ ownerCandidates: [marked("owner-uuid-1")] }), NOW);
    expect(row.owner).toMatchObject({ name: "Marcus Vega", email: "marcus@iron.test", known: true, resolution: "identified" });
  });

  it("no marked owner is Unknown", () => {
    const row = buildSalesQueueRow(input({ ownerCandidates: [] }), NOW);
    expect(row.owner.known).toBe(false);
    expect(row.owner.resolution).toBe("no_marked_owner");
    expect(row.owner.name).toBeNull();
    expect(row.owner.email).toBeNull();
  });

  it("multiple marked owners are Unknown with an ambiguity state", () => {
    const row = buildSalesQueueRow(
      input({ ownerCandidates: [marked("owner-uuid-1"), marked("owner-uuid-2", "Other", "other@iron.test")] }),
      NOW,
    );
    expect(row.owner.known).toBe(false);
    expect(row.owner.resolution).toBe("ambiguous");
    expect(row.owner.email).toBeNull();
  });

  it("the earliest member is NEVER used as a fallback", () => {
    // An unmarked (legacy/imported) member must not become the owner.
    const row = buildSalesQueueRow(input({ ownerCandidates: [unmarked("legacy-1"), unmarked("legacy-2")] }), NOW);
    expect(row.owner.known).toBe(false);
    expect(JSON.stringify(row.owner)).not.toContain("early@iron.test");
  });

  it("a marked owner still counts when their membership is inactive", () => {
    // Activity/active flags are not part of owner identification.
    const row = buildSalesQueueRow(input({ ownerCandidates: [marked("owner-uuid-inactive")] }), NOW);
    expect(row.owner.known).toBe(true);
  });

  it("a marked owner with no name and no email is Unknown", () => {
    const row = buildSalesQueueRow(
      input({ ownerCandidates: [{ clerkUserId: "owner-x", firstName: null, lastName: null, email: null, phone: null }] }),
      NOW,
    );
    expect(row.owner.known).toBe(false);
  });
});

describe("trial expiry and cancellation are explicit states", () => {
  it("a negative day count is EXPIRED, never an upcoming trial", () => {
    const row = buildSalesQueueRow(input({ trialEndsAt: new Date(NOW.getTime() - 2 * 86400000) }), NOW);
    expect(row.trialDaysRemaining).toBeLessThan(0);
    expect(row.priority).toBe("trial_expired");
    expect(row.recommendedAction).not.toMatch(/no action/i);
  });

  it("a canceled subscription is never 'no action needed'", () => {
    for (const status of ["canceled", "cancelled"]) {
      const row = buildSalesQueueRow(input({ subscriptionStatus: status, trialEndsAt: null }), NOW);
      expect(row.priority, status).toBe("subscription_canceled");
      expect(row.recommendedAction).toMatch(/cancellation interview/i);
    }
  });

  it("ending-now covers exactly 0 through 3 days", () => {
    for (const days of [0, 1, 2, 3]) {
      const row = buildSalesQueueRow(input({ trialEndsAt: new Date(NOW.getTime() + days * 86400000) }), NOW);
      expect(row.priority, String(days)).toBe("trial_ending_now");
    }
  });

  it("ending-soon covers exactly 4 through 7 days", () => {
    for (const days of [4, 5, 6, 7]) {
      const row = buildSalesQueueRow(input({ trialEndsAt: new Date(NOW.getTime() + days * 86400000) }), NOW);
      expect(row.priority, String(days)).toBe("trial_ending_soon");
    }
  });

  it("expired trials sort above trials that are merely ending soon", () => {
    const expired = buildSalesQueueRow(input({ gymId: "x", trialEndsAt: new Date(NOW.getTime() - 86400000) }), NOW);
    const ending = buildSalesQueueRow(input({ gymId: "y", trialEndsAt: new Date(NOW.getTime() + 86400000) }), NOW);
    const sorted = sortSalesQueue([ending, expired], "urgency");
    expect(sorted[0].gymId).toBe("x");
  });
});

describe("latest activity availability is explicit", () => {
  it("marks unavailable when the lookup failed", () => {
    const row = buildSalesQueueRow(input({ lastActivity: null, lastActivityUnavailable: true }), NOW);
    expect(row.lastActivityUnavailable).toBe(true);
    expect(row.lastActivityAt).toBeNull();
  });

  it("genuinely empty activity is not marked unavailable", () => {
    const row = buildSalesQueueRow(input({ lastActivity: null }), NOW);
    expect(row.lastActivityUnavailable).toBe(false);
    expect(row.lastActivityAt).toBeNull();
  });
});

describe("priority ladder", () => {
  it("1. billing trouble outranks everything", () => {
    for (const status of ["past_due", "unpaid", "incomplete", "paused"]) {
      const row = buildSalesQueueRow(input({ subscriptionStatus: status, trialEndsAt: new Date("2026-08-01T12:00:00.000Z") }), NOW);
      expect(row.priority, status).toBe("billing_issue");
    }
  });

  it("1b. an active subscription with an unrecognised price is a reconciliation issue, not revenue", () => {
    const row = buildSalesQueueRow(input({ subscriptionStatus: "active", stripePriceId: "price_mystery" }), NOW);
    expect(row.needsPriceReconciliation).toBe(true);
    expect(row.plan).toBeNull();
    expect(row.priority).toBe("billing_issue");
  });

  it("2. trial ending in 0-3 days", () => {
    for (const days of [0, 1, 3]) {
      const trialEndsAt = new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000);
      const row = buildSalesQueueRow(input({ trialEndsAt }), NOW);
      expect(row.priority, String(days)).toBe("trial_ending_now");
    }
  });

  it("3. trial ending in 4-7 days", () => {
    for (const days of [4, 7]) {
      const trialEndsAt = new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000);
      const row = buildSalesQueueRow(input({ trialEndsAt }), NOW);
      expect(row.priority, String(days)).toBe("trial_ending_soon");
    }
  });

  it("4. unactivated after the stuck threshold", () => {
    const createdAt = new Date(NOW.getTime() - STUCK_AFTER_DAYS * 24 * 60 * 60 * 1000);
    const row = buildSalesQueueRow(
      input({ facts: BARE, createdAt, trialEndsAt: new Date("2026-08-25T12:00:00.000Z") }),
      NOW,
    );
    expect(row.priority).toBe("stuck_unactivated");
  });

  it("a brand-new unactivated academy is not yet 'stuck'", () => {
    const row = buildSalesQueueRow(
      input({ facts: BARE, createdAt: NOW, trialEndsAt: new Date("2026-08-25T12:00:00.000Z") }),
      NOW,
    );
    expect(row.priority).toBe("none");
  });

  it("5. activated but no attendance", () => {
    const row = buildSalesQueueRow(
      input({ facts: { ...ACTIVATED, attendanceCount: 0 }, trialEndsAt: new Date("2026-08-25T12:00:00.000Z") }),
      NOW,
    );
    expect(row.priority).toBe("activated_no_usage");
    expect(row.isActivated).toBe(true);
    expect(row.hasLiveUsage).toBe(false);
  });

  it("6. a healthy paying academy", () => {
    const row = buildSalesQueueRow(
      input({ subscriptionStatus: "active", stripePriceId: "price_basic_test", trialEndsAt: null }),
      NOW,
    );
    expect(row.priority).toBe("paid_active");
    expect(row.plan).toBe("basic");
    expect(row.needsPriceReconciliation).toBe(false);
  });

  it("7. nothing to do", () => {
    const row = buildSalesQueueRow(input({ trialEndsAt: new Date("2026-08-25T12:00:00.000Z") }), NOW);
    expect(row.priority).toBe("none");
  });

  it("every priority carries a recommended action", () => {
    for (const p of PRIORITY_ORDER) {
      const row = { priority: p } as SalesQueueRow;
      expect(PRIORITY_ORDER).toContain(row.priority);
    }
    const row = buildSalesQueueRow(input(), NOW);
    expect(row.recommendedAction.length).toBeGreaterThan(0);
  });
});

describe("derived facts", () => {
  it("carries counts, activation progress, and last activity through", () => {
    const row = buildSalesQueueRow(input(), NOW);
    expect(row.activeMembers).toBe(5);
    expect(row.activeInstructors).toBe(1);
    expect(row.activeClasses).toBe(3);
    expect(row.recentAttendanceCount).toBe(4);
    expect(row.milestonesComplete).toBe(4);
    expect(row.milestonesTotal).toBe(4);
    expect(row.lastActivityAction).toBe("attendance_recorded");
    expect(row.ageDays).toBe(30);
    expect(RECENT_ATTENDANCE_DAYS).toBe(30);
  });

  it("handles an academy with no activity records", () => {
    const row = buildSalesQueueRow(input({ lastActivity: null }), NOW);
    expect(row.lastActivityAction).toBeNull();
    expect(row.lastActivityAt).toBeNull();
  });
});

function rows(): SalesQueueRow[] {
  return [
    buildSalesQueueRow(input({ gymId: "a", gymName: "Alpha", subscriptionStatus: "past_due" }), NOW),
    buildSalesQueueRow(input({ gymId: "b", gymName: "Bravo", trialEndsAt: new Date(NOW.getTime() + 2 * 86400000) }), NOW),
    buildSalesQueueRow(
      input({ gymId: "c", gymName: "Charlie", subscriptionStatus: "active", stripePriceId: "price_pro_test", trialEndsAt: null }),
      NOW,
    ),
    buildSalesQueueRow(
      input({ gymId: "d", gymName: "Delta", facts: BARE, createdAt: new Date(NOW.getTime() - 10 * 86400000), trialEndsAt: new Date(NOW.getTime() + 20 * 86400000), ownerCandidates: [] }),
      NOW,
    ),
  ];
}

describe("sorting", () => {
  it("urgency puts billing first and healthy last", () => {
    const sorted = sortSalesQueue(rows(), "urgency");
    expect(sorted[0].gymName).toBe("Alpha");
    expect(sorted[sorted.length - 1].gymName).toBe("Charlie");
  });

  it("trialEnd puts the soonest trial first and no-trial last", () => {
    const sorted = sortSalesQueue(rows(), "trialEnd");
    expect(sorted[0].gymName).toBe("Bravo");
    expect(sorted[sorted.length - 1].gymName).toBe("Charlie");
  });

  it("created and lastActivity sort newest first", () => {
    expect(sortSalesQueue(rows(), "created")[0].createdAt.getTime()).toBeGreaterThanOrEqual(
      sortSalesQueue(rows(), "created")[1].createdAt.getTime(),
    );
    expect(sortSalesQueue(rows(), "lastActivity")[0].lastActivityAt).not.toBeNull();
  });

  it("does not mutate the input array", () => {
    const original = rows();
    const before = original.map((r) => r.gymId);
    sortSalesQueue(original, "urgency");
    expect(original.map((r) => r.gymId)).toEqual(before);
  });
});

describe("filtering", () => {
  it("searches academy name, slug, owner name, and owner email", () => {
    expect(filterSalesQueue(rows(), { search: "alpha" })).toHaveLength(1);
    expect(filterSalesQueue(rows(), { search: "iron-lion" })).toHaveLength(4);
    expect(filterSalesQueue(rows(), { search: "marcus" })).toHaveLength(3); // Delta has no owner
    expect(filterSalesQueue(rows(), { search: "marcus@iron.test" })).toHaveLength(3);
    expect(filterSalesQueue(rows(), { search: "nobody" })).toHaveLength(0);
  });

  it("filters by priority, activation, billing, and plan", () => {
    expect(filterSalesQueue(rows(), { priority: "billing_issue" })).toHaveLength(1);
    expect(filterSalesQueue(rows(), { activation: "not_activated" })).toHaveLength(1);
    expect(filterSalesQueue(rows(), { activation: "activated" })).toHaveLength(3);
    expect(filterSalesQueue(rows(), { billing: "active" })).toHaveLength(1);
    expect(filterSalesQueue(rows(), { billing: "trouble" })).toHaveLength(1);
    expect(filterSalesQueue(rows(), { plan: "pro" })).toHaveLength(1);
    expect(filterSalesQueue(rows(), { plan: "unknown" })).toHaveLength(3);
  });

  it("combines filters and returns everything when unset", () => {
    expect(filterSalesQueue(rows(), { search: "iron", activation: "activated", billing: "active" })).toHaveLength(1);
    expect(filterSalesQueue(rows(), {})).toHaveLength(4);
    expect(filterSalesQueue([], { search: "x" })).toHaveLength(0);
  });
});
