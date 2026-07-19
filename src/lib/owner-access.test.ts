import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  gymFindUnique: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/prisma", () => ({ prisma: { gym: { findUnique: mocks.gymFindUnique } } }));

import { requireOwnerAccess, requirePlan, EntitlementError, entitlementErrorBody } from "./owner-access";

const FUTURE = new Date(Date.now() + 10 * 24 * 3600 * 1000);
const PAST = new Date(Date.now() - 24 * 3600 * 1000);

function gymState(over: Partial<{ subscriptionStatus: string; trialEndsAt: Date | null; stripePriceId: string | null; approved: boolean }>) {
  return { subscriptionStatus: "trialing", trialEndsAt: FUTURE, stripePriceId: null, approved: true, ...over };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.STRIPE_BASIC_PRICE_ID = "price_basic_test";
  process.env.STRIPE_PRO_PRICE_ID = "price_pro_test";
  mocks.requireAdmin.mockResolvedValue({ gymId: "gym_1", userId: "u1", orgId: "gym_1", orgRole: "org:admin", memberId: "m1" });
  mocks.gymFindUnique.mockResolvedValue(gymState({}));
});

describe("requireOwnerAccess", () => {
  it("passes for a valid trial and returns the entitlement", async () => {
    const ctx = await requireOwnerAccess();
    expect(ctx.gymId).toBe("gym_1");
    expect(ctx.entitlement.state).toBe("trialing");
  });

  it("passes for active Basic, active Pro, and legacy free", async () => {
    for (const state of [
      gymState({ subscriptionStatus: "active", stripePriceId: "price_basic_test", trialEndsAt: null }),
      gymState({ subscriptionStatus: "active", stripePriceId: "price_pro_test", trialEndsAt: null }),
      gymState({ subscriptionStatus: "free", trialEndsAt: null }),
    ]) {
      mocks.gymFindUnique.mockResolvedValue(state);
      await expect(requireOwnerAccess()).resolves.toBeTruthy();
    }
  });

  it("throws SUBSCRIPTION_REQUIRED for expired trial, canceled, legacy cancelled, past_due, unknown", async () => {
    for (const state of [
      gymState({ subscriptionStatus: "trialing", trialEndsAt: PAST }),
      gymState({ subscriptionStatus: "canceled", trialEndsAt: null }),
      gymState({ subscriptionStatus: "cancelled", trialEndsAt: null }),
      gymState({ subscriptionStatus: "past_due", trialEndsAt: null }),
      gymState({ subscriptionStatus: "something_weird", trialEndsAt: null }),
    ]) {
      mocks.gymFindUnique.mockResolvedValue(state);
      await expect(requireOwnerAccess()).rejects.toMatchObject({ code: "SUBSCRIPTION_REQUIRED" });
    }
  });

  it("propagates auth failures untouched (401 handling stays with the route)", async () => {
    mocks.requireAdmin.mockRejectedValue(new Error("Unauthorized"));
    await expect(requireOwnerAccess()).rejects.toThrow("Unauthorized");
  });
});

describe("requirePlan('pro')", () => {
  it("passes only for a genuine Pro price", async () => {
    mocks.gymFindUnique.mockResolvedValue(gymState({ subscriptionStatus: "active", stripePriceId: "price_pro_test", trialEndsAt: null }));
    await expect(requirePlan("pro")).resolves.toBeTruthy();
  });

  it("rejects trial, Basic, unknown-price active, and legacy free with PRO_REQUIRED", async () => {
    for (const state of [
      gymState({}),
      gymState({ subscriptionStatus: "active", stripePriceId: "price_basic_test", trialEndsAt: null }),
      gymState({ subscriptionStatus: "active", stripePriceId: "price_rogue", trialEndsAt: null }),
      gymState({ subscriptionStatus: "free", trialEndsAt: null }),
    ]) {
      mocks.gymFindUnique.mockResolvedValue(state);
      await expect(requirePlan("pro")).rejects.toMatchObject({ code: "PRO_REQUIRED" });
    }
  });
});

describe("entitlementErrorBody", () => {
  it("maps EntitlementError to a structured 402 body and ignores other errors", async () => {
    mocks.gymFindUnique.mockResolvedValue(gymState({ subscriptionStatus: "canceled", trialEndsAt: null }));
    const err = await requireOwnerAccess().catch((e) => e);
    expect(err).toBeInstanceOf(EntitlementError);
    expect(entitlementErrorBody(err)).toEqual({ error: expect.any(String), code: "SUBSCRIPTION_REQUIRED" });
    expect(entitlementErrorBody(new Error("boom"))).toBeNull();
  });
});
