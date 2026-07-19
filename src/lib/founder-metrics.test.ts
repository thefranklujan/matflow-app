import { describe, it, expect, beforeEach } from "vitest";
import { buildFounderBreakdown, classifyGym, type FounderGymRow } from "./founder-metrics";

const NOW = new Date("2026-07-15T12:00:00");
const FUTURE = new Date("2026-07-25T12:00:00"); // 10d out
const SOON = new Date("2026-07-18T12:00:00"); // 3d out
const PAST = new Date("2026-07-01T12:00:00");
const OLD = new Date("2026-06-01T12:00:00");
const RECENT = new Date("2026-07-14T12:00:00"); // 1d ago (not stuck yet)

let seq = 0;
function gym(over: Partial<FounderGymRow>): FounderGymRow {
  seq += 1;
  return {
    id: `g${seq}`,
    name: `Gym ${seq}`,
    subscriptionStatus: "trialing",
    stripePriceId: null,
    trialEndsAt: FUTURE,
    approved: true,
    createdAt: OLD,
    activeMemberCount: 5,
    ...over,
  };
}

beforeEach(() => {
  seq = 0;
  process.env.STRIPE_BASIC_PRICE_ID = "price_basic_x";
  process.env.STRIPE_PRO_PRICE_ID = "price_pro_x";
});

describe("classifyGym", () => {
  it("maps every billing state to its founder class", () => {
    const cases: [Partial<FounderGymRow>, string][] = [
      [{ subscriptionStatus: "active", stripePriceId: "price_basic_x" }, "basic"],
      [{ subscriptionStatus: "active", stripePriceId: "price_pro_x" }, "pro"],
      [{ subscriptionStatus: "active", stripePriceId: "price_rogue" }, "active_unknown_price"],
      [{ subscriptionStatus: "trialing", trialEndsAt: FUTURE }, "trialing_valid"],
      [{ subscriptionStatus: "trialing", trialEndsAt: PAST }, "trial_expired"],
      [{ subscriptionStatus: "past_due" }, "past_due"],
      [{ subscriptionStatus: "paused" }, "past_due"],
      [{ subscriptionStatus: "canceled" }, "canceled"],
      [{ subscriptionStatus: "cancelled" }, "canceled"],
      [{ subscriptionStatus: "free" }, "legacy_free"],
      [{ subscriptionStatus: "gibberish" }, "unknown"],
    ];
    for (const [over, expected] of cases) {
      expect(classifyGym(gym(over), NOW), JSON.stringify(over)).toBe(expected);
    }
  });
});

describe("buildFounderBreakdown", () => {
  it("computes allow-list MRR only, with reconciliation for everything excluded", () => {
    const rows = [
      gym({ subscriptionStatus: "active", stripePriceId: "price_basic_x" }),
      gym({ subscriptionStatus: "active", stripePriceId: "price_basic_x" }),
      gym({ subscriptionStatus: "active", stripePriceId: "price_pro_x" }),
      gym({ subscriptionStatus: "active", stripePriceId: "price_rogue" }), // NOT revenue
      gym({ subscriptionStatus: "free" }), // NOT revenue
      gym({ subscriptionStatus: "canceled" }), // NOT revenue
      gym({ subscriptionStatus: "trialing", trialEndsAt: FUTURE }), // NOT revenue
      gym({ id: "platform-owner-gym", subscriptionStatus: "active", stripePriceId: "price_pro_x" }), // synthetic: excluded entirely
    ];
    const b = buildFounderBreakdown(rows, NOW);
    expect(b.totalReal).toBe(7); // synthetic excluded
    expect(b.counts.basic).toBe(2);
    expect(b.counts.pro).toBe(1);
    expect(b.grossMrrEstimateUsd).toBe(2 * 49 + 1 * 99); // 197 — never x49 blanket
    expect(b.reconciliation.map((r) => r.reason).sort()).toEqual(["active_unknown_price", "legacy_free"].sort());
  });

  it("trial buckets respect the 7-day boundary and sort by urgency", () => {
    const ending = gym({ trialEndsAt: SOON });
    const notEnding = gym({ trialEndsAt: FUTURE }); // 10d — outside window
    const expired = gym({ trialEndsAt: PAST });
    const b = buildFounderBreakdown([ending, notEnding, expired], NOW);
    expect(b.counts.trialing_valid).toBe(2);
    expect(b.counts.trial_expired).toBe(1);
    expect(b.trialsEnding7d).toHaveLength(1);
    expect(b.trialsEnding7d[0].gymId).toBe(ending.id);
    expect(b.trialsEnding7d[0].daysLeft).toBe(3);
  });

  it("needs-onboarding: only APPROVED, access-holding gyms with <=1 ACTIVE member after 3 days", () => {
    const stuck = gym({ activeMemberCount: 1, createdAt: OLD });
    const newSolo = gym({ activeMemberCount: 1, createdAt: RECENT }); // too new to be stuck
    const activated = gym({ activeMemberCount: 4 });
    // Excluded despite being old + solo: canceled, expired, unknown, unapproved, payment-locked.
    const canceled = gym({ activeMemberCount: 1, createdAt: OLD, subscriptionStatus: "canceled", trialEndsAt: null });
    const expired = gym({ activeMemberCount: 1, createdAt: OLD, trialEndsAt: PAST });
    const unknown = gym({ activeMemberCount: 1, createdAt: OLD, subscriptionStatus: "gibberish", trialEndsAt: null });
    const unapproved = gym({ activeMemberCount: 1, createdAt: OLD, approved: false });
    const locked = gym({ activeMemberCount: 1, createdAt: OLD, subscriptionStatus: "past_due", trialEndsAt: null });
    const b = buildFounderBreakdown([stuck, newSolo, activated, canceled, expired, unknown, unapproved, locked], NOW);
    expect(b.needsOnboardingHelp.map((g) => g.gymId)).toEqual([stuck.id]);
    expect(b.activatedGyms).toBe(1); // 2+ ACTIVE members, directly measurable
  });

  it("activation counts ACTIVE members only — a gym full of inactive records is not activated", () => {
    // activeMemberCount is the filtered count the page passes; a gym whose
    // 10 members are all inactive arrives here as activeMemberCount 0.
    const ghost = gym({ activeMemberCount: 0, createdAt: OLD });
    const b = buildFounderBreakdown([ghost], NOW);
    expect(b.activatedGyms).toBe(0);
    expect(b.needsOnboardingHelp.map((g) => g.gymId)).toEqual([ghost.id]);
  });

  it("partially configured allow-list: unmatched plan falls to reconciliation, matched plan still counts", () => {
    delete process.env.STRIPE_PRO_PRICE_ID;
    delete process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID;
    const basic = gym({ subscriptionStatus: "active", stripePriceId: "price_basic_x", trialEndsAt: null });
    const pro = gym({ subscriptionStatus: "active", stripePriceId: "price_pro_x", trialEndsAt: null });
    const b = buildFounderBreakdown([basic, pro], NOW);
    expect(b.counts.basic).toBe(1);
    expect(b.counts.active_unknown_price).toBe(1); // pro price no longer recognized
    expect(b.grossMrrEstimateUsd).toBe(49); // never guesses the unmatched one
  });

  it("with NO allow-list configured, active gyms fall to reconciliation and MRR is $0", () => {
    delete process.env.STRIPE_BASIC_PRICE_ID;
    delete process.env.STRIPE_PRO_PRICE_ID;
    delete process.env.NEXT_PUBLIC_STRIPE_BASIC_PRICE_ID;
    delete process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID;
    const b = buildFounderBreakdown([gym({ subscriptionStatus: "active", stripePriceId: "price_basic_x" })], NOW);
    expect(b.grossMrrEstimateUsd).toBe(0);
    expect(b.counts.active_unknown_price).toBe(1);
  });
});
