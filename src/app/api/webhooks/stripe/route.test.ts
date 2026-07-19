import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  subscriptionsRetrieve: vi.fn(),
  gymUpdate: vi.fn(),
  gymUpdateMany: vi.fn(),
}));

vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    webhooks: { constructEvent: mocks.constructEvent },
    subscriptions: { retrieve: mocks.subscriptionsRetrieve },
  }),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { gym: { update: mocks.gymUpdate, updateMany: mocks.gymUpdateMany } },
}));

import { POST } from "./route";

function req(body = "{}", sig: string | null = "t=1,v1=sig") {
  const headers = new Headers();
  if (sig) headers.set("stripe-signature", sig);
  return new Request("http://localhost/api/webhooks/stripe", {
    method: "POST",
    headers,
    body,
  }) as unknown as import("next/server").NextRequest;
}

function stripeEvent(type: string, object: Record<string, unknown>) {
  return { id: `evt_${type}`, type, data: { object } };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_dummy";
  mocks.gymUpdate.mockResolvedValue({});
  mocks.gymUpdateMany.mockResolvedValue({ count: 1 });
});

describe("Stripe webhook — signature verification", () => {
  it("400 when the signature header is missing", async () => {
    expect((await POST(req("{}", null))).status).toBe(400);
    expect(mocks.constructEvent).not.toHaveBeenCalled();
  });

  it("400 when webhook secret is not configured", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    expect((await POST(req())).status).toBe(400);
  });

  it("400 and NO writes when the signature is invalid", async () => {
    mocks.constructEvent.mockImplementation(() => { throw new Error("bad sig"); });
    expect((await POST(req())).status).toBe(400);
    expect(mocks.gymUpdate).not.toHaveBeenCalled();
    expect(mocks.gymUpdateMany).not.toHaveBeenCalled();
  });
});

describe("Stripe webhook — subscription lifecycle transitions", () => {
  it("checkout.session.completed activates the gym with the subscription's price", async () => {
    mocks.constructEvent.mockReturnValue(stripeEvent("checkout.session.completed", {
      metadata: { gymId: "gym_1" }, customer: "cus_1", subscription: "sub_1",
    }));
    mocks.subscriptionsRetrieve.mockResolvedValue({ items: { data: [{ price: { id: "price_basic" } }] } });
    expect((await POST(req())).status).toBe(200);
    expect(mocks.gymUpdate).toHaveBeenCalledWith({
      where: { id: "gym_1" },
      data: { stripeCustomerId: "cus_1", subscriptionStatus: "active", stripePriceId: "price_basic", trialEndsAt: null },
    });
  });

  it("subscription.updated writes Stripe's status and price verbatim (incl. unknown price ids)", async () => {
    mocks.constructEvent.mockReturnValue(stripeEvent("customer.subscription.updated", {
      metadata: { gymId: "gym_1" }, status: "past_due",
      items: { data: [{ price: { id: "price_totally_unknown" } }] },
    }));
    expect((await POST(req())).status).toBe(200);
    // The unknown id is stored as-is; the entitlement layer (not the webhook)
    // is what refuses to grant a plan for it.
    expect(mocks.gymUpdate).toHaveBeenCalledWith({
      where: { id: "gym_1" },
      data: { subscriptionStatus: "past_due", stripePriceId: "price_totally_unknown" },
    });
  });

  it("subscription.deleted cancels; payment_failed marks past_due by customer", async () => {
    mocks.constructEvent.mockReturnValue(stripeEvent("customer.subscription.deleted", { metadata: { gymId: "gym_1" } }));
    await POST(req());
    expect(mocks.gymUpdate).toHaveBeenCalledWith({ where: { id: "gym_1" }, data: { subscriptionStatus: "canceled" } });

    mocks.constructEvent.mockReturnValue(stripeEvent("invoice.payment_failed", { customer: "cus_1" }));
    await POST(req());
    expect(mocks.gymUpdateMany).toHaveBeenCalledWith({
      where: { stripeCustomerId: "cus_1" },
      data: { subscriptionStatus: "past_due" },
    });
  });
});

describe("Stripe webhook — malformed and hostile payloads", () => {
  it("events with missing/malformed gym metadata are acknowledged without writes", async () => {
    for (const object of [{}, { metadata: {} }, { metadata: { gymId: undefined } }]) {
      mocks.gymUpdate.mockClear();
      mocks.constructEvent.mockReturnValue(stripeEvent("customer.subscription.updated", object));
      expect((await POST(req())).status).toBe(200); // ack so Stripe stops retrying
      expect(mocks.gymUpdate).not.toHaveBeenCalled();
    }
  });

  it("unrecognized event types are acknowledged without writes", async () => {
    mocks.constructEvent.mockReturnValue(stripeEvent("charge.refunded", { id: "ch_1" }));
    expect((await POST(req())).status).toBe(200);
    expect(mocks.gymUpdate).not.toHaveBeenCalled();
  });

  it("a DB failure returns 500 so Stripe retries", async () => {
    mocks.constructEvent.mockReturnValue(stripeEvent("customer.subscription.deleted", { metadata: { gymId: "gym_1" } }));
    mocks.gymUpdate.mockRejectedValue(new Error("db down"));
    expect((await POST(req())).status).toBe(500);
  });
});

describe("Stripe webhook — duplicate and out-of-order limits (current schema)", () => {
  it("duplicate deliveries re-apply the same terminal write (idempotent OUTCOME, not tracked)", async () => {
    mocks.constructEvent.mockReturnValue(stripeEvent("customer.subscription.deleted", { metadata: { gymId: "gym_1" } }));
    await POST(req());
    await POST(req());
    expect(mocks.gymUpdate).toHaveBeenCalledTimes(2); // same data both times — converges
    const calls = mocks.gymUpdate.mock.calls;
    expect(calls[0]).toEqual(calls[1]);
  });

  it("DOCUMENTED GAP: out-of-order updated-after-deleted overwrites the newer state", async () => {
    // Without the PACKET-2 event log the handler cannot order events: a stale
    // "active" subscription.updated arriving AFTER deleted resurrects access.
    // This test pins the CURRENT behavior so the gap stays visible until
    // PACKET-2 is approved and applied.
    mocks.constructEvent.mockReturnValue(stripeEvent("customer.subscription.deleted", { metadata: { gymId: "gym_1" } }));
    await POST(req());
    mocks.constructEvent.mockReturnValue(stripeEvent("customer.subscription.updated", {
      metadata: { gymId: "gym_1" }, status: "active", items: { data: [{ price: { id: "price_basic" } }] },
    }));
    await POST(req());
    expect(mocks.gymUpdate).toHaveBeenLastCalledWith({
      where: { id: "gym_1" },
      data: { subscriptionStatus: "active", stripePriceId: "price_basic" },
    });
  });
});
