import { describe, it, expect, vi, beforeEach } from "vitest";

// Route dependency mocks — hoisted by vitest before the route import below.
const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  findUnique: vi.fn(),
  gymUpdate: vi.fn(),
  createCheckoutSession: vi.fn(),
  createPortalSession: vi.fn(),
  hasLiveSubscription: vi.fn(),
  ensureCustomer: vi.fn(),
  findOpenSubscriptionCheckout: vi.fn(),
  expireCheckoutSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/prisma", () => ({
  prisma: { gym: { findUnique: mocks.findUnique, update: mocks.gymUpdate } },
}));
vi.mock("@/lib/stripe", () => ({
  createCheckoutSession: mocks.createCheckoutSession,
  createPortalSession: mocks.createPortalSession,
  hasLiveSubscription: mocks.hasLiveSubscription,
  ensureCustomer: mocks.ensureCustomer,
  findOpenSubscriptionCheckout: mocks.findOpenSubscriptionCheckout,
  expireCheckoutSession: mocks.expireCheckoutSession,
  // Real predicate, not a stub — the route's conflict handling depends on it.
  isIdempotencyConflict: (err: unknown) => {
    const e = err as { type?: string; raw?: { type?: string } } | null;
    return e?.type === "StripeIdempotencyError" || e?.raw?.type === "idempotency_error";
  },
}));

import { POST } from "./route";

function req(body: unknown) {
  return new Request("http://localhost/api/billing", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;
}

function gymRow(over: Partial<{ stripeCustomerId: string | null; subscriptionStatus: string; stripePriceId: string | null }> = {}) {
  return { stripeCustomerId: null, subscriptionStatus: "trialing", stripePriceId: null, ...over };
}

function idemError() {
  return Object.assign(new Error("Keys for idempotent requests can only be used with the same parameters"), {
    raw: { type: "idempotency_error" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.STRIPE_BASIC_PRICE_ID = "price_basic_test";
  process.env.STRIPE_PRO_PRICE_ID = "price_pro_test";
  mocks.requireAdmin.mockResolvedValue({ gymId: "gym_1" });
  mocks.findUnique.mockResolvedValue(gymRow());
  mocks.gymUpdate.mockResolvedValue({});
  mocks.ensureCustomer.mockResolvedValue("cus_1");
  mocks.hasLiveSubscription.mockResolvedValue(false);
  mocks.findOpenSubscriptionCheckout.mockResolvedValue(null);
  mocks.expireCheckoutSession.mockResolvedValue(undefined);
  mocks.createCheckoutSession.mockResolvedValue({ url: "https://checkout.stripe.test/s1" });
  mocks.createPortalSession.mockResolvedValue({ url: "https://portal.stripe.test/p" });
});

describe("POST /api/billing — auth and validation", () => {
  it("401 only for authentication failure", async () => {
    mocks.requireAdmin.mockRejectedValue(new Error("Unauthorized"));
    const res = await POST(req({ action: "checkout", plan: "basic" }));
    expect(res.status).toBe(401);
  });

  it("400 for unknown plan key and for client price-ID injection via plan", async () => {
    for (const plan of ["enterprise", "price_attacker_supplied"]) {
      const res = await POST(req({ action: "checkout", plan }));
      expect(res.status, plan).toBe(400);
    }
    expect(mocks.createCheckoutSession).not.toHaveBeenCalled();
  });

  it("server maps plan->price and passes a SERVER-owned idempotency key; client priceId ignored", async () => {
    await POST(req({ action: "checkout", plan: "basic", priceId: "price_attacker", idempotencyKey: "client-key" }));
    const [gymId, customerId, priceId, key] = mocks.createCheckoutSession.mock.calls[0];
    expect(gymId).toBe("gym_1");
    expect(customerId).toBe("cus_1");
    expect(priceId).toBe("price_basic_test");
    expect(key).toMatch(/^sub-checkout:gym_1:\d+$/); // never the client's key
  });

  it("503 when the plan's price is not configured", async () => {
    delete process.env.STRIPE_BASIC_PRICE_ID;
    delete process.env.NEXT_PUBLIC_STRIPE_BASIC_PRICE_ID;
    const res = await POST(req({ action: "checkout", plan: "basic" }));
    expect(res.status).toBe(503);
  });

  it("400 for invalid action", async () => {
    const res = await POST(req({ action: "refund" }));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/billing — duplicate-subscription prevention (DB state)", () => {
  it("409 for EVERY existing-relationship state: active, unknown-price active, past_due, unpaid, incomplete, paused, Stripe-side trialing", async () => {
    const rows = [
      gymRow({ subscriptionStatus: "active", stripePriceId: "price_pro_test", stripeCustomerId: "cus_1" }),
      gymRow({ subscriptionStatus: "active", stripePriceId: "price_rogue_unknown", stripeCustomerId: "cus_1" }),
      gymRow({ subscriptionStatus: "past_due", stripeCustomerId: "cus_1" }),
      gymRow({ subscriptionStatus: "unpaid", stripeCustomerId: "cus_1" }),
      gymRow({ subscriptionStatus: "incomplete", stripeCustomerId: "cus_1" }),
      // paused was previously missing from the DB hard-block: a paused gym with
      // a missing/corrupt customer id could reach a fresh customer + Checkout.
      gymRow({ subscriptionStatus: "paused", stripeCustomerId: "cus_1" }),
      gymRow({ subscriptionStatus: "paused", stripeCustomerId: null }),
      gymRow({ subscriptionStatus: "trialing", stripePriceId: "price_basic_test", stripeCustomerId: "cus_1" }),
    ];
    for (const row of rows) {
      mocks.findUnique.mockResolvedValue(row);
      const res = await POST(req({ action: "checkout", plan: "basic" }));
      expect(res.status, `${row.subscriptionStatus}/${row.stripePriceId}/${row.stripeCustomerId}`).toBe(409);
    }
    expect(mocks.createCheckoutSession).not.toHaveBeenCalled();
    expect(mocks.ensureCustomer).not.toHaveBeenCalled(); // no fresh customer for blocked states
  });

  it("ALLOWS checkout for: card-less app trial, canceled, legacy cancelled, legacy free, expired trial", async () => {
    const rows = [
      gymRow(), // app-level trialing, no Stripe price
      gymRow({ subscriptionStatus: "canceled", stripeCustomerId: "cus_1" }),
      gymRow({ subscriptionStatus: "cancelled", stripeCustomerId: "cus_1" }),
      gymRow({ subscriptionStatus: "free" }),
      gymRow({ subscriptionStatus: "trial_expired" }),
    ];
    for (const row of rows) {
      mocks.findUnique.mockResolvedValue(row);
      const res = await POST(req({ action: "checkout", plan: "basic" }));
      expect(res.status, row.subscriptionStatus).toBe(200);
    }
  });

  it("409 when Stripe still shows a live subscription (webhook lag)", async () => {
    mocks.findUnique.mockResolvedValue(gymRow({ subscriptionStatus: "canceled", stripeCustomerId: "cus_1" }));
    mocks.hasLiveSubscription.mockResolvedValue(true);
    const res = await POST(req({ action: "checkout", plan: "basic" }));
    expect(res.status).toBe(409);
  });

  it("502 fail-closed when the live-subscription check or customer creation fails", async () => {
    mocks.hasLiveSubscription.mockRejectedValue(new Error("stripe down"));
    expect((await POST(req({ action: "checkout", plan: "basic" }))).status).toBe(502);
    mocks.hasLiveSubscription.mockResolvedValue(false);
    mocks.ensureCustomer.mockRejectedValue(new Error("stripe down"));
    expect((await POST(req({ action: "checkout", plan: "basic" }))).status).toBe(502);
    expect(mocks.createCheckoutSession).not.toHaveBeenCalled();
  });
});

describe("POST /api/billing — customer identity", () => {
  it("creates ONE customer per gym (server-owned idempotent) and persists it", async () => {
    await POST(req({ action: "checkout", plan: "basic" }));
    expect(mocks.ensureCustomer).toHaveBeenCalledWith("gym_1", null);
    expect(mocks.gymUpdate).toHaveBeenCalledWith({ where: { id: "gym_1" }, data: { stripeCustomerId: "cus_1" } });
  });

  it("customer-creation race: both requests resolve to the SAME customer id", async () => {
    const [r1, r2] = await Promise.all([
      POST(req({ action: "checkout", plan: "basic" })),
      POST(req({ action: "checkout", plan: "basic" })),
    ]);
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    const customers = mocks.createCheckoutSession.mock.calls.map((c) => c[1]);
    expect(new Set(customers).size).toBe(1); // single cus_1 anchor for the gym
  });

  it("reuses the existing customer without touching Stripe customer creation persistence", async () => {
    mocks.findUnique.mockResolvedValue(gymRow({ stripeCustomerId: "cus_existing" }));
    mocks.ensureCustomer.mockResolvedValue("cus_existing");
    await POST(req({ action: "checkout", plan: "basic" }));
    expect(mocks.gymUpdate).not.toHaveBeenCalled();
  });
});

describe("POST /api/billing — open-session and concurrency behavior", () => {
  it("reuses an existing OPEN session for the same plan (duplicate click / second tab)", async () => {
    mocks.findOpenSubscriptionCheckout.mockResolvedValue({ id: "cs_1", url: "https://checkout.stripe.test/open", priceId: "price_basic_test" });
    const res = await POST(req({ action: "checkout", plan: "basic" }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.reused).toBe(true);
    expect(body.url).toContain("/open");
    expect(mocks.createCheckoutSession).not.toHaveBeenCalled();
  });

  it("expires an open session for a DIFFERENT plan before creating the new one", async () => {
    mocks.findOpenSubscriptionCheckout.mockResolvedValue({ id: "cs_1", url: "https://checkout.stripe.test/open", priceId: "price_basic_test" });
    const res = await POST(req({ action: "checkout", plan: "pro" }));
    expect(res.status).toBe(200);
    expect(mocks.expireCheckoutSession).toHaveBeenCalledWith("cs_1");
    expect(mocks.createCheckoutSession).toHaveBeenCalled();
  });

  it("an expired session is not reused (list returns none) — fresh create", async () => {
    mocks.findOpenSubscriptionCheckout.mockResolvedValue(null);
    const res = await POST(req({ action: "checkout", plan: "basic" }));
    expect(res.status).toBe(200);
    expect(mocks.createCheckoutSession).toHaveBeenCalled();
  });

  it("SAME-PLAN simultaneous requests: Stripe idempotency returns one session for both", async () => {
    // Emulate Stripe's documented idempotent behavior for the shared key.
    const store = new Map<string, { url: string }>();
    mocks.createCheckoutSession.mockImplementation(async (_g: string, _c: string, priceId: string, key: string) => {
      const composite = `${key}|${priceId}`;
      for (const existing of store.keys()) {
        if (existing.startsWith(`${key}|`) && existing !== composite) throw idemError();
      }
      if (!store.has(composite)) store.set(composite, { url: `https://checkout.stripe.test/${key}` });
      return store.get(composite)!;
    });
    const [r1, r2] = await Promise.all([
      POST(req({ action: "checkout", plan: "basic" })),
      POST(req({ action: "checkout", plan: "basic" })),
    ]);
    const [b1, b2] = [await r1.json(), await r2.json()];
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(b1.url).toBe(b2.url); // ONE session, not two
    expect(store.size).toBe(1);
  });

  it("DIFFERENT-PLAN simultaneous requests: exactly one session; the loser gets 409", async () => {
    const store = new Map<string, { url: string }>();
    mocks.createCheckoutSession.mockImplementation(async (_g: string, _c: string, priceId: string, key: string) => {
      const composite = `${key}|${priceId}`;
      for (const existing of store.keys()) {
        if (existing.startsWith(`${key}|`) && existing !== composite) throw idemError();
      }
      if (!store.has(composite)) store.set(composite, { url: `https://checkout.stripe.test/${priceId}` });
      return store.get(composite)!;
    });
    const [r1, r2] = await Promise.all([
      POST(req({ action: "checkout", plan: "basic" })),
      POST(req({ action: "checkout", plan: "pro" })),
    ]);
    const statuses = [r1.status, r2.status].sort();
    expect(statuses).toEqual([200, 409]);
    const conflictBody = await (r1.status === 409 ? r1 : r2).json();
    expect(conflictBody.code).toBe("CHECKOUT_IN_PROGRESS");
    expect(store.size).toBe(1); // Stripe never created a second session
  });

  it("Stripe timeout during create fails closed with 502 (retry-safe via idempotency key)", async () => {
    mocks.createCheckoutSession.mockRejectedValue(new Error("ETIMEDOUT"));
    const res = await POST(req({ action: "checkout", plan: "basic" }));
    expect(res.status).toBe(502);
  });
});

describe("POST /api/billing — portal", () => {
  it("400 without a Stripe customer; 200 with; 502 on Stripe failure", async () => {
    expect((await POST(req({ action: "portal" }))).status).toBe(400);
    mocks.findUnique.mockResolvedValue(gymRow({ stripeCustomerId: "cus_1" }));
    expect((await POST(req({ action: "portal" }))).status).toBe(200);
    mocks.createPortalSession.mockRejectedValue(new Error("down"));
    expect((await POST(req({ action: "portal" }))).status).toBe(502);
  });
});
