import { describe, it, expect, vi, beforeEach } from "vitest";

// Route dependency mocks — hoisted by vitest before the route import below.
const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  findUnique: vi.fn(),
  createCheckoutSession: vi.fn(),
  createPortalSession: vi.fn(),
  hasLiveSubscription: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/prisma", () => ({ prisma: { gym: { findUnique: mocks.findUnique } } }));
vi.mock("@/lib/stripe", () => ({
  createCheckoutSession: mocks.createCheckoutSession,
  createPortalSession: mocks.createPortalSession,
  hasLiveSubscription: mocks.hasLiveSubscription,
}));

import { POST } from "./route";

function req(body: unknown) {
  return new Request("http://localhost/api/billing", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    // Route only uses request.json(); a plain Request satisfies it.
  }) as unknown as import("next/server").NextRequest;
}

function gymRow(over: Partial<{ stripeCustomerId: string | null; subscriptionStatus: string; stripePriceId: string | null }> = {}) {
  return { stripeCustomerId: null, subscriptionStatus: "trialing", stripePriceId: null, ...over };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.STRIPE_BASIC_PRICE_ID = "price_basic_test";
  process.env.STRIPE_PRO_PRICE_ID = "price_pro_test";
  mocks.requireAdmin.mockResolvedValue({ gymId: "gym_1" });
  mocks.findUnique.mockResolvedValue(gymRow());
  mocks.createCheckoutSession.mockResolvedValue({ url: "https://checkout.stripe.test/s" });
  mocks.createPortalSession.mockResolvedValue({ url: "https://portal.stripe.test/p" });
  mocks.hasLiveSubscription.mockResolvedValue(false);
});

describe("POST /api/billing — auth and validation", () => {
  it("401 only for authentication failure", async () => {
    mocks.requireAdmin.mockRejectedValue(new Error("Unauthorized"));
    const res = await POST(req({ action: "checkout", plan: "basic" }));
    expect(res.status).toBe(401);
  });

  it("400 for unknown plan key", async () => {
    const res = await POST(req({ action: "checkout", plan: "enterprise" }));
    expect(res.status).toBe(400);
  });

  it("400 for client price-ID injection via plan field", async () => {
    const res = await POST(req({ action: "checkout", plan: "price_attacker_supplied" }));
    expect(res.status).toBe(400);
    expect(mocks.createCheckoutSession).not.toHaveBeenCalled();
  });

  it("legacy client priceId field is ignored — server price is used", async () => {
    await POST(req({ action: "checkout", plan: "basic", priceId: "price_attacker" }));
    expect(mocks.createCheckoutSession).toHaveBeenCalledWith("gym_1", null, "price_basic_test");
  });

  it("503 when the plan's price is not configured", async () => {
    delete process.env.STRIPE_BASIC_PRICE_ID;
    delete process.env.NEXT_PUBLIC_STRIPE_BASIC_PRICE_ID;
    const res = await POST(req({ action: "checkout", plan: "basic" }));
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe("PRICE_NOT_CONFIGURED");
  });

  it("400 for invalid action", async () => {
    const res = await POST(req({ action: "refund" }));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/billing — duplicate-subscription prevention (P0)", () => {
  it("409 when gym is already active", async () => {
    mocks.findUnique.mockResolvedValue(gymRow({ subscriptionStatus: "active", stripePriceId: "price_pro_test", stripeCustomerId: "cus_1" }));
    const res = await POST(req({ action: "checkout", plan: "basic" }));
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("SUBSCRIPTION_EXISTS");
    expect(mocks.createCheckoutSession).not.toHaveBeenCalled();
  });

  it("409 for past_due / unpaid / incomplete (subscription exists, must use portal)", async () => {
    for (const status of ["past_due", "unpaid", "incomplete"]) {
      mocks.findUnique.mockResolvedValue(gymRow({ subscriptionStatus: status, stripeCustomerId: "cus_1" }));
      const res = await POST(req({ action: "checkout", plan: "pro" }));
      expect(res.status, status).toBe(409);
    }
    expect(mocks.createCheckoutSession).not.toHaveBeenCalled();
  });

  it("409 for a Stripe-side trialing subscription (priceId set)", async () => {
    mocks.findUnique.mockResolvedValue(gymRow({ subscriptionStatus: "trialing", stripePriceId: "price_basic_test", stripeCustomerId: "cus_1" }));
    const res = await POST(req({ action: "checkout", plan: "pro" }));
    expect(res.status).toBe(409);
  });

  it("ALLOWS the card-less app trial (trialing, no priceId) to subscribe", async () => {
    mocks.findUnique.mockResolvedValue(gymRow({ subscriptionStatus: "trialing", stripePriceId: null }));
    const res = await POST(req({ action: "checkout", plan: "basic" }));
    expect(res.status).toBe(200);
    expect((await res.json()).url).toContain("checkout.stripe.test");
  });

  it("ALLOWS a canceled customer to resubscribe when Stripe confirms no live subscription", async () => {
    mocks.findUnique.mockResolvedValue(gymRow({ subscriptionStatus: "canceled", stripeCustomerId: "cus_1" }));
    mocks.hasLiveSubscription.mockResolvedValue(false);
    const res = await POST(req({ action: "checkout", plan: "basic" }));
    expect(res.status).toBe(200);
    expect(mocks.hasLiveSubscription).toHaveBeenCalledWith("cus_1");
  });

  it("409 when DB says canceled but Stripe still has a live subscription (webhook lag)", async () => {
    mocks.findUnique.mockResolvedValue(gymRow({ subscriptionStatus: "canceled", stripeCustomerId: "cus_1" }));
    mocks.hasLiveSubscription.mockResolvedValue(true);
    const res = await POST(req({ action: "checkout", plan: "basic" }));
    expect(res.status).toBe(409);
    expect(mocks.createCheckoutSession).not.toHaveBeenCalled();
  });

  it("502 fail-closed when the Stripe duplicate check itself fails", async () => {
    mocks.findUnique.mockResolvedValue(gymRow({ subscriptionStatus: "canceled", stripeCustomerId: "cus_1" }));
    mocks.hasLiveSubscription.mockRejectedValue(new Error("stripe down"));
    const res = await POST(req({ action: "checkout", plan: "basic" }));
    expect(res.status).toBe(502);
    expect(mocks.createCheckoutSession).not.toHaveBeenCalled();
  });
});

describe("POST /api/billing — Stripe failures and portal", () => {
  it("502 when Checkout creation throws", async () => {
    mocks.createCheckoutSession.mockRejectedValue(new Error("stripe down"));
    const res = await POST(req({ action: "checkout", plan: "basic" }));
    expect(res.status).toBe(502);
  });

  it("portal 400 without a Stripe customer", async () => {
    const res = await POST(req({ action: "portal" }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("NO_CUSTOMER");
  });

  it("portal 200 with a customer", async () => {
    mocks.findUnique.mockResolvedValue(gymRow({ stripeCustomerId: "cus_1" }));
    const res = await POST(req({ action: "portal" }));
    expect(res.status).toBe(200);
    expect((await res.json()).url).toContain("portal.stripe.test");
  });

  it("portal 502 when Stripe portal creation throws", async () => {
    mocks.findUnique.mockResolvedValue(gymRow({ stripeCustomerId: "cus_1" }));
    mocks.createPortalSession.mockRejectedValue(new Error("stripe down"));
    const res = await POST(req({ action: "portal" }));
    expect(res.status).toBe(502);
  });
});
