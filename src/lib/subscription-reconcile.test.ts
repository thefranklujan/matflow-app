import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  subscriptionsRetrieve: vi.fn(),
  gymFindUnique: vi.fn(),
  gymFindMany: vi.fn(),
  gymUpdate: vi.fn(),
}));

vi.mock("./stripe", () => ({
  getStripe: () => ({ subscriptions: { retrieve: mocks.subscriptionsRetrieve } }),
}));
vi.mock("./prisma", () => ({
  prisma: { gym: { findUnique: mocks.gymFindUnique, findMany: mocks.gymFindMany, update: mocks.gymUpdate } },
}));

import { ReconciliationConflict, reconcileSubscription, resolveGymForSubscription } from "./subscription-reconcile";

function subscription(over: Record<string, unknown> = {}) {
  return {
    id: "sub_1",
    status: "active",
    customer: "cus_1",
    metadata: { gymId: "gym_1" },
    items: { data: [{ price: { id: "price_basic" } }] },
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.gymUpdate.mockResolvedValue({});
});

describe("resolveGymForSubscription", () => {
  it("resolves from subscription metadata when the academy exists", async () => {
    mocks.gymFindUnique.mockResolvedValue({ id: "gym_1", stripeCustomerId: "cus_1" });
    const r = await resolveGymForSubscription(subscription());
    expect(r).toMatchObject({ outcome: "resolved", gymId: "gym_1" });
    // Metadata is authoritative; no customer lookup is needed.
    expect(mocks.gymFindMany).not.toHaveBeenCalled();
  });

  it("accepts metadata when the academy has no customer stored yet", async () => {
    mocks.gymFindUnique.mockResolvedValue({ id: "gym_1", stripeCustomerId: null });
    expect(await resolveGymForSubscription(subscription())).toMatchObject({ outcome: "resolved", gymId: "gym_1" });
  });

  it("refuses when metadata and the stored customer disagree about ownership", async () => {
    mocks.gymFindUnique.mockResolvedValue({ id: "gym_1", stripeCustomerId: "cus_OTHER" });
    const r = await resolveGymForSubscription(subscription());
    expect(r.outcome).toBe("ambiguous");
    expect(r.gymId).toBeNull();
  });

  it("reports no_match when metadata names an academy that does not exist", async () => {
    mocks.gymFindUnique.mockResolvedValue(null);
    expect((await resolveGymForSubscription(subscription())).outcome).toBe("no_match");
  });

  it("falls back to a UNIQUE stored customer when metadata is absent", async () => {
    mocks.gymFindMany.mockResolvedValue([{ id: "gym_7" }]);
    const r = await resolveGymForSubscription(subscription({ metadata: {} }));
    expect(r).toMatchObject({ outcome: "resolved", gymId: "gym_7" });
  });

  it("refuses when several academies share one billing customer", async () => {
    mocks.gymFindMany.mockResolvedValue([{ id: "gym_a" }, { id: "gym_b" }]);
    const r = await resolveGymForSubscription(subscription({ metadata: {} }));
    expect(r.outcome).toBe("ambiguous");
    expect(r.gymId).toBeNull();
  });

  it("reports no_match when nothing holds the customer", async () => {
    mocks.gymFindMany.mockResolvedValue([]);
    expect((await resolveGymForSubscription(subscription({ metadata: {} }))).outcome).toBe("no_match");
  });

  it("reports no_match when there is neither metadata nor a customer", async () => {
    const r = await resolveGymForSubscription(subscription({ metadata: {}, customer: null }));
    expect(r.outcome).toBe("no_match");
    expect(mocks.gymFindMany).not.toHaveBeenCalled();
  });

  it("accepts an expanded customer object, not only an id string", async () => {
    mocks.gymFindMany.mockResolvedValue([{ id: "gym_7" }]);
    const r = await resolveGymForSubscription(subscription({ metadata: {}, customer: { id: "cus_1" } }));
    expect(r).toMatchObject({ outcome: "resolved", gymId: "gym_7" });
  });
});

describe("reconcileSubscription", () => {
  it("writes the status Stripe reports right now, not the one in the event", async () => {
    mocks.subscriptionsRetrieve.mockResolvedValue(subscription({ status: "past_due" }));
    mocks.gymFindUnique.mockResolvedValue({ id: "gym_1", stripeCustomerId: "cus_1" });

    const r = await reconcileSubscription("sub_1");
    expect(r).toMatchObject({ outcome: "resolved", gymId: "gym_1", status: "past_due" });
    expect(mocks.gymUpdate).toHaveBeenCalledWith({
      where: { id: "gym_1" },
      data: { subscriptionStatus: "past_due", stripePriceId: "price_basic", stripeCustomerId: "cus_1" },
    });
  });

  it("clears the trial only when the subscription supersedes it", async () => {
    for (const [status, clears] of [["active", true], ["trialing", true], ["incomplete", false], ["canceled", false]] as const) {
      vi.clearAllMocks();
      mocks.gymUpdate.mockResolvedValue({});
      mocks.subscriptionsRetrieve.mockResolvedValue(subscription({ status }));
      mocks.gymFindUnique.mockResolvedValue({ id: "gym_1", stripeCustomerId: "cus_1" });
      await reconcileSubscription("sub_1");
      const data = mocks.gymUpdate.mock.calls[0][0].data;
      expect(Object.prototype.hasOwnProperty.call(data, "trialEndsAt"), status).toBe(clears);
    }
  });

  it("throws ReconciliationConflict on ambiguous ownership and writes NOTHING", async () => {
    mocks.subscriptionsRetrieve.mockResolvedValue(subscription({ metadata: {} }));
    mocks.gymFindMany.mockResolvedValue([{ id: "gym_a" }, { id: "gym_b" }]);

    await expect(reconcileSubscription("sub_1")).rejects.toBeInstanceOf(ReconciliationConflict);
    expect(mocks.gymUpdate).not.toHaveBeenCalled();
  });

  it("the conflict message carries no Stripe identifiers", async () => {
    mocks.subscriptionsRetrieve.mockResolvedValue(subscription({ metadata: {} }));
    mocks.gymFindMany.mockResolvedValue([{ id: "gym_a" }, { id: "gym_b" }]);
    const err = await reconcileSubscription("sub_1").catch((e) => e as Error);
    expect(err.message).not.toMatch(/sub_|cus_|price_/);
  });

  it("returns no_match without writing when nothing owns the subscription", async () => {
    mocks.subscriptionsRetrieve.mockResolvedValue(subscription({ metadata: {} }));
    mocks.gymFindMany.mockResolvedValue([]);
    expect((await reconcileSubscription("sub_1")).outcome).toBe("no_match");
    expect(mocks.gymUpdate).not.toHaveBeenCalled();
  });

  it("stores the price from the CURRENT subscription, so a stale plan cannot return", async () => {
    mocks.subscriptionsRetrieve.mockResolvedValue(
      subscription({ items: { data: [{ price: { id: "price_pro" } }] } }),
    );
    mocks.gymFindUnique.mockResolvedValue({ id: "gym_1", stripeCustomerId: "cus_1" });
    await reconcileSubscription("sub_1");
    expect(mocks.gymUpdate.mock.calls[0][0].data.stripePriceId).toBe("price_pro");
  });

  it("a canceled subscription reconciles cleanly", async () => {
    mocks.subscriptionsRetrieve.mockResolvedValue(subscription({ status: "canceled" }));
    mocks.gymFindUnique.mockResolvedValue({ id: "gym_1", stripeCustomerId: "cus_1" });
    const r = await reconcileSubscription("sub_1");
    expect(r.status).toBe("canceled");
    expect(mocks.gymUpdate.mock.calls[0][0].data.subscriptionStatus).toBe("canceled");
  });
});
