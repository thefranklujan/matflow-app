import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the stripe SDK so the REAL lib logic (per-status querying) is exercised.
const mocks = vi.hoisted(() => ({
  subscriptionsList: vi.fn(),
  customersCreate: vi.fn(),
  portalSessionsCreate: vi.fn(),
}));

vi.mock("stripe", () => ({
  default: class StripeMock {
    subscriptions = { list: mocks.subscriptionsList };
    customers = { create: mocks.customersCreate };
    billingPortal = { sessions: { create: mocks.portalSessionsCreate } };
  },
}));

import { hasLiveSubscription, ensureCustomer, isIdempotencyConflict, createPortalSession } from "./stripe";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.STRIPE_SECRET_KEY = "sk_test_dummy_for_unit_tests";
  delete process.env.STRIPE_PORTAL_CONFIGURATION_ID;
  mocks.portalSessionsCreate.mockResolvedValue({ url: "https://portal.example/session" });
});

describe("createPortalSession — optional per-mode configuration", () => {
  // Production has no configuration pinned today; that behavior must not change.
  it("omits `configuration` entirely when none is set", async () => {
    await createPortalSession("cus_1");
    const params = mocks.portalSessionsCreate.mock.calls[0][0];
    expect(params).not.toHaveProperty("configuration");
    expect(params.customer).toBe("cus_1");
    expect(params.return_url).toMatch(/\/app\/billing$/);
  });

  // A sandbox run pins the configuration it provisioned, so plan switching is
  // proven against a KNOWN catalog rather than the account default.
  it("passes the configuration through when one is set", async () => {
    process.env.STRIPE_PORTAL_CONFIGURATION_ID = "bpc_FAKE";
    await createPortalSession("cus_1");
    expect(mocks.portalSessionsCreate.mock.calls[0][0].configuration).toBe("bpc_FAKE");
  });

  it("treats a blank configuration as absent rather than passing an empty id", async () => {
    for (const blank of ["", "   "]) {
      vi.clearAllMocks();
      mocks.portalSessionsCreate.mockResolvedValue({ url: "u" });
      process.env.STRIPE_PORTAL_CONFIGURATION_ID = blank;
      await createPortalSession("cus_1");
      expect(mocks.portalSessionsCreate.mock.calls[0][0]).not.toHaveProperty("configuration");
    }
  });

  it("trims a padded configuration id", async () => {
    process.env.STRIPE_PORTAL_CONFIGURATION_ID = "  bpc_FAKE  ";
    await createPortalSession("cus_1");
    expect(mocks.portalSessionsCreate.mock.calls[0][0].configuration).toBe("bpc_FAKE");
  });
});

describe("hasLiveSubscription — no pagination blind spot", () => {
  it("queries every LIVE status individually (never status:'all' with a page cap)", async () => {
    mocks.subscriptionsList.mockResolvedValue({ data: [] });
    const result = await hasLiveSubscription("cus_many_history");
    expect(result).toBe(false);
    const statuses = mocks.subscriptionsList.mock.calls.map((c) => c[0].status).sort();
    expect(statuses).toEqual(["active", "incomplete", "past_due", "paused", "trialing", "unpaid"].sort());
    expect(mocks.subscriptionsList.mock.calls.every((c) => c[0].status !== "all")).toBe(true);
  });

  it("finds a live 'paused' subscription even with >10 historical canceled subs", async () => {
    // Historical canceled subs never appear: we only query live states, and
    // the paused query returns the hit regardless of history volume.
    mocks.subscriptionsList.mockImplementation(async ({ status }: { status: string }) => ({
      data: status === "paused" ? [{ id: "sub_live", status: "paused" }] : [],
    }));
    expect(await hasLiveSubscription("cus_15_canceled")).toBe(true);
  });

  it("short-circuits on the first live hit", async () => {
    mocks.subscriptionsList.mockResolvedValue({ data: [{ id: "sub_1", status: "active" }] });
    await hasLiveSubscription("cus_1");
    expect(mocks.subscriptionsList).toHaveBeenCalledTimes(1);
  });
});

describe("ensureCustomer — one customer per gym", () => {
  it("returns the existing id without calling Stripe", async () => {
    expect(await ensureCustomer("gym_1", "cus_existing")).toBe("cus_existing");
    expect(mocks.customersCreate).not.toHaveBeenCalled();
  });

  it("creates with a server-owned idempotency key derived from the gymId", async () => {
    mocks.customersCreate.mockResolvedValue({ id: "cus_new" });
    expect(await ensureCustomer("gym_1", null)).toBe("cus_new");
    expect(mocks.customersCreate).toHaveBeenCalledWith(
      { metadata: { gymId: "gym_1" } },
      { idempotencyKey: "customer:gym_1" },
    );
  });
});

describe("isIdempotencyConflict", () => {
  it("detects both Stripe error shapes and rejects others", () => {
    expect(isIdempotencyConflict({ raw: { type: "idempotency_error" } })).toBe(true);
    expect(isIdempotencyConflict({ type: "StripeIdempotencyError" })).toBe(true);
    expect(isIdempotencyConflict(new Error("boom"))).toBe(false);
    expect(isIdempotencyConflict(null)).toBe(false);
  });
});
