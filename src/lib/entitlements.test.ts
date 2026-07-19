import { describe, it, expect, beforeEach } from "vitest";
import {
  deriveEntitlement,
  planForPriceId,
  priceIdForPlan,
  planSatisfies,
  isPlanKey,
  BASIC_MEMBER_LIMIT,
  type GymBillingFields,
} from "./entitlements";

const BASIC = "price_basic_test";
const PRO = "price_pro_test";
const NOW = new Date("2026-07-18T00:00:00Z");
const FUTURE = new Date("2026-08-01T00:00:00Z");
const PAST = new Date("2026-07-01T00:00:00Z");

beforeEach(() => {
  process.env.STRIPE_BASIC_PRICE_ID = BASIC;
  process.env.STRIPE_PRO_PRICE_ID = PRO;
  delete process.env.NEXT_PUBLIC_STRIPE_BASIC_PRICE_ID;
  delete process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID;
});

function gym(over: Partial<GymBillingFields>): GymBillingFields {
  return { subscriptionStatus: "trialing", trialEndsAt: FUTURE, stripePriceId: null, approved: true, ...over };
}

describe("price allow-list", () => {
  it("maps plan keys to configured prices", () => {
    expect(priceIdForPlan("basic")).toBe(BASIC);
    expect(priceIdForPlan("pro")).toBe(PRO);
  });
  it("reverse-maps known prices, rejects unknown", () => {
    expect(planForPriceId(BASIC)).toBe("basic");
    expect(planForPriceId(PRO)).toBe("pro");
    expect(planForPriceId("price_someone_elses")).toBeNull();
    expect(planForPriceId(null)).toBeNull();
  });
  it("validates plan keys", () => {
    expect(isPlanKey("basic")).toBe(true);
    expect(isPlanKey("pro")).toBe(true);
    expect(isPlanKey("enterprise")).toBe(false);
    expect(isPlanKey(undefined)).toBe(false);
  });
});

describe("deriveEntitlement", () => {
  it("valid trial => Basic access, 100-member cap", () => {
    const e = deriveEntitlement(gym({ subscriptionStatus: "trialing", trialEndsAt: FUTURE }), NOW);
    expect(e.state).toBe("trialing");
    expect(e.plan).toBe("basic");
    expect(e.hasOwnerAccess).toBe(true);
    expect(e.memberLimit).toBe(BASIC_MEMBER_LIMIT);
  });

  it("expired trial => locked out", () => {
    const e = deriveEntitlement(gym({ subscriptionStatus: "trialing", trialEndsAt: PAST }), NOW);
    expect(e.state).toBe("expired");
    expect(e.hasOwnerAccess).toBe(false);
  });

  it("active Basic => access, 100 cap", () => {
    const e = deriveEntitlement(gym({ subscriptionStatus: "active", stripePriceId: BASIC, trialEndsAt: null }), NOW);
    expect(e.plan).toBe("basic");
    expect(e.hasOwnerAccess).toBe(true);
    expect(e.memberLimit).toBe(BASIC_MEMBER_LIMIT);
  });

  it("active Pro => access, unlimited", () => {
    const e = deriveEntitlement(gym({ subscriptionStatus: "active", stripePriceId: PRO, trialEndsAt: null }), NOW);
    expect(e.plan).toBe("pro");
    expect(e.hasOwnerAccess).toBe(true);
    expect(e.memberLimit).toBeNull();
  });

  it("active but UNKNOWN price => access, never Pro, flagged, capped at Basic", () => {
    const e = deriveEntitlement(gym({ subscriptionStatus: "active", stripePriceId: "price_unknown", trialEndsAt: null }), NOW);
    expect(e.plan).toBeNull();
    expect(e.unknownPrice).toBe(true);
    expect(e.hasOwnerAccess).toBe(true);
    expect(e.memberLimit).toBe(BASIC_MEMBER_LIMIT);
  });

  it("past_due and canceled => locked out, capped (never unlimited)", () => {
    const pd = deriveEntitlement(gym({ subscriptionStatus: "past_due", stripePriceId: PRO, trialEndsAt: null }), NOW);
    expect(pd.hasOwnerAccess).toBe(false);
    expect(pd.memberLimit).toBe(BASIC_MEMBER_LIMIT);
    const c = deriveEntitlement(gym({ subscriptionStatus: "canceled", trialEndsAt: null }), NOW);
    expect(c.state).toBe("canceled");
    expect(c.hasOwnerAccess).toBe(false);
    expect(c.memberLimit).toBe(BASIC_MEMBER_LIMIT);
  });

  it("legacy 'free' => PRESERVED access at Basic level (never locked by rollout)", () => {
    const e = deriveEntitlement(gym({ subscriptionStatus: "free", trialEndsAt: null }), NOW);
    expect(e.state).toBe("legacy_free");
    expect(e.plan).toBe("basic");
    expect(e.hasOwnerAccess).toBe(true);
    expect(e.memberLimit).toBe(BASIC_MEMBER_LIMIT);
  });

  it("legacy double-l 'cancelled' behaves exactly like canonical 'canceled'", () => {
    const e = deriveEntitlement(gym({ subscriptionStatus: "cancelled", trialEndsAt: null }), NOW);
    expect(e.state).toBe("canceled");
    expect(e.hasOwnerAccess).toBe(false);
  });

  it("unpaid/incomplete Stripe statuses lock like past_due", () => {
    for (const s of ["unpaid", "incomplete"]) {
      const e = deriveEntitlement(gym({ subscriptionStatus: s, trialEndsAt: null }), NOW);
      expect(e.state, s).toBe("past_due");
      expect(e.hasOwnerAccess, s).toBe(false);
    }
  });

  it("pending approval => no access even on a valid trial", () => {
    const e = deriveEntitlement(gym({ subscriptionStatus: "trialing", trialEndsAt: FUTURE, approved: false }), NOW);
    expect(e.pendingApproval).toBe(true);
    expect(e.hasOwnerAccess).toBe(false);
  });
});

describe("planSatisfies", () => {
  it("Pro subscription satisfies both basic and pro", () => {
    const pro = deriveEntitlement(gym({ subscriptionStatus: "active", stripePriceId: PRO, trialEndsAt: null }), NOW);
    expect(planSatisfies(pro, "basic")).toBe(true);
    expect(planSatisfies(pro, "pro")).toBe(true);
  });
  it("Basic/trial satisfies basic but NOT pro", () => {
    const basic = deriveEntitlement(gym({ subscriptionStatus: "trialing", trialEndsAt: FUTURE }), NOW);
    expect(planSatisfies(basic, "basic")).toBe(true);
    expect(planSatisfies(basic, "pro")).toBe(false);
  });
  it("unknown-price active never satisfies pro", () => {
    const unk = deriveEntitlement(gym({ subscriptionStatus: "active", stripePriceId: "price_unknown", trialEndsAt: null }), NOW);
    expect(planSatisfies(unk, "pro")).toBe(false);
  });
  it("locked-out never satisfies anything", () => {
    const c = deriveEntitlement(gym({ subscriptionStatus: "canceled", trialEndsAt: null }), NOW);
    expect(planSatisfies(c, "basic")).toBe(false);
    expect(planSatisfies(c, "pro")).toBe(false);
  });
});
