import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  subscriptionsRetrieve: vi.fn(),
  gymFindUnique: vi.fn(),
  gymFindMany: vi.fn(),
  gymUpdate: vi.fn(),
}));

vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    webhooks: { constructEvent: mocks.constructEvent },
    subscriptions: { retrieve: mocks.subscriptionsRetrieve },
  }),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { gym: { findUnique: mocks.gymFindUnique, findMany: mocks.gymFindMany, update: mocks.gymUpdate } },
}));

import { POST } from "./route";

function req(body = "{}", sig: string | null = "t=1,v1=sig") {
  const headers = new Headers();
  if (sig) headers.set("stripe-signature", sig);
  return new Request("http://localhost/api/webhooks/stripe", { method: "POST", headers, body }) as unknown as
    import("next/server").NextRequest;
}

function stripeEvent(type: string, object: Record<string, unknown>, id = `evt_${type}`) {
  return { id, type, data: { object } };
}

/** What Stripe would return from subscriptions.retrieve right now. */
function stripeSubscription(over: Record<string, unknown> = {}) {
  return {
    id: "sub_1",
    status: "active",
    customer: "cus_1",
    metadata: { gymId: "gym_1" },
    items: { data: [{ price: { id: "price_basic" } }] },
    ...over,
  };
}

/** The academy that owns the subscription above. */
function ownedByGym1() {
  mocks.gymFindUnique.mockResolvedValue({ id: "gym_1", stripeCustomerId: "cus_1" });
}

const lastWrite = () => mocks.gymUpdate.mock.calls.at(-1)?.[0];

beforeEach(() => {
  vi.clearAllMocks();
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_dummy";
  mocks.gymUpdate.mockResolvedValue({});
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
  });

  it("verification uses the RAW body exactly as received", async () => {
    const raw = '{"id":"evt_1","spacing":  "preserved"}';
    mocks.constructEvent.mockReturnValue(stripeEvent("unknown.type", {}));
    await POST(req(raw));
    expect(mocks.constructEvent).toHaveBeenCalledWith(raw, "t=1,v1=sig", "whsec_test_dummy");
  });
});

describe("Stripe webhook — checkout completion", () => {
  it("activates from the subscription Stripe reports, not from the event type", async () => {
    mocks.constructEvent.mockReturnValue(stripeEvent("checkout.session.completed", {
      metadata: { gymId: "gym_1" }, customer: "cus_1", subscription: "sub_1",
    }));
    mocks.subscriptionsRetrieve.mockResolvedValue(stripeSubscription());
    ownedByGym1();

    expect((await POST(req())).status).toBe(200);
    expect(lastWrite()).toEqual({
      where: { id: "gym_1" },
      data: { subscriptionStatus: "active", stripePriceId: "price_basic", stripeCustomerId: "cus_1", trialEndsAt: null },
    });
  });

  // Stripe is explicit that a completed Checkout Session does not prove the
  // payment succeeded: in subscription mode it can be `incomplete`. Marking
  // such a gym active would hand out paid entitlement for an unpaid plan.
  it("does NOT activate when Stripe says the subscription is incomplete", async () => {
    mocks.constructEvent.mockReturnValue(stripeEvent("checkout.session.completed", {
      metadata: { gymId: "gym_1" }, customer: "cus_1", subscription: "sub_1",
    }));
    mocks.subscriptionsRetrieve.mockResolvedValue(stripeSubscription({ status: "incomplete" }));
    ownedByGym1();

    expect((await POST(req())).status).toBe(200);
    const data = lastWrite().data;
    expect(data.subscriptionStatus).toBe("incomplete");
    // The in-app trial must survive, or the owner has neither trial nor access.
    expect(data).not.toHaveProperty("trialEndsAt");
  });

  it("async_payment_succeeded is handled on the same path (delayed payment methods)", async () => {
    mocks.constructEvent.mockReturnValue(stripeEvent("checkout.session.async_payment_succeeded", {
      metadata: { gymId: "gym_1" }, customer: "cus_1", subscription: "sub_1",
    }));
    mocks.subscriptionsRetrieve.mockResolvedValue(stripeSubscription({ items: { data: [{ price: { id: "price_pro" } }] } }));
    ownedByGym1();

    expect((await POST(req())).status).toBe(200);
    expect(lastWrite().data.stripePriceId).toBe("price_pro");
  });

  it("a session with no subscription records the customer but grants nothing", async () => {
    mocks.constructEvent.mockReturnValue(stripeEvent("checkout.session.completed", {
      metadata: { gymId: "gym_1" }, customer: "cus_1", subscription: null,
    }));
    expect((await POST(req())).status).toBe(200);
    expect(mocks.subscriptionsRetrieve).not.toHaveBeenCalled();
    expect(lastWrite()).toEqual({ where: { id: "gym_1" }, data: { stripeCustomerId: "cus_1" } });
  });
});

describe("Stripe webhook — subscription changes re-read Stripe", () => {
  it("subscription.updated writes Stripe's current state, ignoring the payload status", async () => {
    mocks.constructEvent.mockReturnValue(stripeEvent("customer.subscription.updated", {
      id: "sub_1", status: "active", metadata: { gymId: "gym_1" },
      items: { data: [{ price: { id: "price_STALE" } }] },
    }));
    // Stripe's actual current state disagrees with the payload.
    mocks.subscriptionsRetrieve.mockResolvedValue(stripeSubscription({ status: "past_due", items: { data: [{ price: { id: "price_pro" } }] } }));
    ownedByGym1();

    expect((await POST(req())).status).toBe(200);
    expect(lastWrite().data.subscriptionStatus).toBe("past_due");
    expect(lastWrite().data.stripePriceId).toBe("price_pro");
  });

  it("subscription.deleted reconciles to Stripe's terminal state", async () => {
    mocks.constructEvent.mockReturnValue(stripeEvent("customer.subscription.deleted", { id: "sub_1", metadata: { gymId: "gym_1" } }));
    mocks.subscriptionsRetrieve.mockResolvedValue(stripeSubscription({ status: "canceled" }));
    ownedByGym1();

    expect((await POST(req())).status).toBe(200);
    expect(lastWrite().data.subscriptionStatus).toBe("canceled");
  });

  // This is the regression the previous implementation had: a stale `updated`
  // arriving after a newer `deleted` used to resurrect the subscription.
  it("a STALE updated arriving after a newer deleted no longer resurrects it", async () => {
    ownedByGym1();
    mocks.subscriptionsRetrieve.mockResolvedValue(stripeSubscription({ status: "canceled" }));

    mocks.constructEvent.mockReturnValue(stripeEvent("customer.subscription.deleted", { id: "sub_1", metadata: { gymId: "gym_1" } }));
    await POST(req());

    // The stale event still claims "active". Stripe still says canceled.
    mocks.constructEvent.mockReturnValue(stripeEvent("customer.subscription.updated", {
      id: "sub_1", status: "active", metadata: { gymId: "gym_1" }, items: { data: [{ price: { id: "price_basic" } }] },
    }));
    await POST(req());

    expect(lastWrite().data.subscriptionStatus).toBe("canceled");
  });

  it("duplicate delivery of the same event converges on the same state", async () => {
    ownedByGym1();
    mocks.subscriptionsRetrieve.mockResolvedValue(stripeSubscription({ status: "active" }));
    const dup = stripeEvent("customer.subscription.updated", { id: "sub_1", metadata: { gymId: "gym_1" } }, "evt_same");
    mocks.constructEvent.mockReturnValue(dup);

    await POST(req());
    const first = lastWrite();
    await POST(req());
    expect(lastWrite()).toEqual(first);
  });
});

describe("Stripe webhook — tenant safety", () => {
  it("payment_failed reconciles instead of assuming past_due", async () => {
    mocks.constructEvent.mockReturnValue(stripeEvent("invoice.payment_failed", { customer: "cus_1", subscription: "sub_1" }));
    mocks.subscriptionsRetrieve.mockResolvedValue(stripeSubscription({ status: "past_due" }));
    ownedByGym1();

    expect((await POST(req())).status).toBe(200);
    expect(lastWrite().data.subscriptionStatus).toBe("past_due");
  });

  // On a subscription's FIRST invoice Stripe keeps the subscription
  // `incomplete`, not `past_due`.
  it("payment_failed on a first invoice records incomplete, not past_due", async () => {
    mocks.constructEvent.mockReturnValue(stripeEvent("invoice.payment_failed", { customer: "cus_1", subscription: "sub_1" }));
    mocks.subscriptionsRetrieve.mockResolvedValue(stripeSubscription({ status: "incomplete" }));
    ownedByGym1();

    await POST(req());
    expect(lastWrite().data.subscriptionStatus).toBe("incomplete");
  });

  it("payment_failed on an invoice with no subscription touches nothing", async () => {
    mocks.constructEvent.mockReturnValue(stripeEvent("invoice.payment_failed", { customer: "cus_1", subscription: null }));
    expect((await POST(req())).status).toBe(200);
    expect(mocks.gymUpdate).not.toHaveBeenCalled();
    expect(mocks.subscriptionsRetrieve).not.toHaveBeenCalled();
  });

  // The old implementation used updateMany by customer id, which would mutate
  // EVERY academy sharing that customer. Now it refuses and asks for a retry.
  it("several academies sharing one customer causes a 500 and NO write", async () => {
    mocks.constructEvent.mockReturnValue(stripeEvent("invoice.payment_failed", { customer: "cus_1", subscription: "sub_1" }));
    mocks.subscriptionsRetrieve.mockResolvedValue(stripeSubscription({ metadata: {} }));
    mocks.gymFindMany.mockResolvedValue([{ id: "gym_a" }, { id: "gym_b" }]);

    expect((await POST(req())).status).toBe(500);
    expect(mocks.gymUpdate).not.toHaveBeenCalled();
  });

  it("an unknown customer is acknowledged with 200 and no write", async () => {
    mocks.constructEvent.mockReturnValue(stripeEvent("customer.subscription.updated", { id: "sub_1" }));
    mocks.subscriptionsRetrieve.mockResolvedValue(stripeSubscription({ metadata: {} }));
    mocks.gymFindMany.mockResolvedValue([]);

    expect((await POST(req())).status).toBe(200);
    expect(mocks.gymUpdate).not.toHaveBeenCalled();
  });

  it("metadata that disagrees with the stored customer is refused with 500", async () => {
    mocks.constructEvent.mockReturnValue(stripeEvent("customer.subscription.updated", { id: "sub_1", metadata: { gymId: "gym_1" } }));
    mocks.subscriptionsRetrieve.mockResolvedValue(stripeSubscription());
    mocks.gymFindUnique.mockResolvedValue({ id: "gym_1", stripeCustomerId: "cus_SOMEONE_ELSE" });

    expect((await POST(req())).status).toBe(500);
    expect(mocks.gymUpdate).not.toHaveBeenCalled();
  });
});

describe("Stripe webhook — malformed payloads and transient failure", () => {
  it("checkout events with missing gym metadata are acknowledged without writes", async () => {
    for (const object of [{}, { metadata: {} }, { metadata: { gymId: undefined } }]) {
      vi.clearAllMocks();
      mocks.constructEvent.mockReturnValue(stripeEvent("checkout.session.completed", object));
      expect((await POST(req())).status).toBe(200);
      expect(mocks.gymUpdate).not.toHaveBeenCalled();
    }
  });

  it("unrecognized event types are acknowledged without writes", async () => {
    mocks.constructEvent.mockReturnValue(stripeEvent("payment_intent.succeeded", {}));
    expect((await POST(req())).status).toBe(200);
    expect(mocks.gymUpdate).not.toHaveBeenCalled();
  });

  it("a DB failure returns 500 so Stripe retries", async () => {
    mocks.constructEvent.mockReturnValue(stripeEvent("customer.subscription.updated", { id: "sub_1", metadata: { gymId: "gym_1" } }));
    mocks.subscriptionsRetrieve.mockResolvedValue(stripeSubscription());
    ownedByGym1();
    mocks.gymUpdate.mockRejectedValue(new Error("db down"));

    expect((await POST(req())).status).toBe(500);
  });

  it("a Stripe read failure returns 500 so Stripe retries", async () => {
    mocks.constructEvent.mockReturnValue(stripeEvent("customer.subscription.updated", { id: "sub_1", metadata: { gymId: "gym_1" } }));
    mocks.subscriptionsRetrieve.mockRejectedValue(new Error("stripe down"));

    expect((await POST(req())).status).toBe(500);
    expect(mocks.gymUpdate).not.toHaveBeenCalled();
  });
});
