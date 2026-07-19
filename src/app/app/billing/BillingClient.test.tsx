// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import React from "react";

const mocks = vi.hoisted(() => ({ useAuth: vi.fn() }));
vi.mock("@/lib/auth-context", () => ({ useAuth: mocks.useAuth }));

import BillingClient from "./BillingClient";

type AuthState = {
  billing: { approved: boolean; subscriptionStatus: string; trialEndsAt: string | null; stripePriceId: string | null } | null;
  entitlement: { state: string; plan: "basic" | "pro" | null; hasOwnerAccess: boolean; memberLimit: number | null; unknownPrice: boolean } | null;
};

const FUTURE = new Date(Date.now() + 10 * 24 * 3600 * 1000).toISOString();

function auth(over: Partial<AuthState> = {}): AuthState {
  return {
    billing: { approved: true, subscriptionStatus: "trialing", trialEndsAt: FUTURE, stripePriceId: null },
    entitlement: { state: "trialing", plan: "basic", hasOwnerAccess: true, memberLimit: 100, unknownPrice: false },
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useAuth.mockReturnValue(auth());
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("BillingClient — controls per state", () => {
  it("app-level card-less trial: Subscribe buttons, no portal controls", () => {
    render(<BillingClient />);
    expect(screen.getAllByRole("button", { name: "Subscribe" })).toHaveLength(2);
    expect(screen.queryByRole("button", { name: /billing portal/i })).toBeNull();
    expect(screen.getByText("Free Trial Active")).toBeTruthy();
  });

  it("active Basic: Manage Subscription on current plan, portal change on the other, NO Subscribe", () => {
    mocks.useAuth.mockReturnValue(auth({
      billing: { approved: true, subscriptionStatus: "active", trialEndsAt: null, stripePriceId: "price_b" },
      entitlement: { state: "active", plan: "basic", hasOwnerAccess: true, memberLimit: 100, unknownPrice: false },
    }));
    render(<BillingClient />);
    expect(screen.queryByRole("button", { name: "Subscribe" })).toBeNull();
    expect(screen.getByRole("button", { name: "Manage Subscription" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Change Plan in Billing Portal" })).toBeTruthy();
    expect(screen.getByText("Current Plan")).toBeTruthy();
  });

  it("every Stripe-backed non-active state shows portal controls, never Checkout: past_due, unpaid, incomplete, paused, Stripe-trialing", () => {
    const states = [
      ["past_due", "Payment Failed"],
      ["unpaid", "Payment Failed"],
      ["incomplete", "Payment Incomplete"],
      ["paused", "Subscription Paused"],
    ] as const;
    for (const [status, banner] of states) {
      cleanup();
      mocks.useAuth.mockReturnValue(auth({
        billing: { approved: true, subscriptionStatus: status, trialEndsAt: null, stripePriceId: "price_b" },
        entitlement: { state: "past_due", plan: "basic", hasOwnerAccess: false, memberLimit: 100, unknownPrice: false },
      }));
      render(<BillingClient />);
      expect(screen.queryByRole("button", { name: "Subscribe" }), status).toBeNull();
      expect(screen.getByText(banner), status).toBeTruthy();
    }
    // Stripe-side trialing (has a price) is also an existing relationship.
    cleanup();
    mocks.useAuth.mockReturnValue(auth({
      billing: { approved: true, subscriptionStatus: "trialing", trialEndsAt: FUTURE, stripePriceId: "price_b" },
      entitlement: { state: "trialing", plan: "basic", hasOwnerAccess: true, memberLimit: 100, unknownPrice: false },
    }));
    render(<BillingClient />);
    expect(screen.queryByRole("button", { name: "Subscribe" })).toBeNull();
  });

  it("canceled and expired states re-enable Subscribe (new Checkout is legitimate)", () => {
    for (const status of ["canceled", "trial_expired"]) {
      cleanup();
      mocks.useAuth.mockReturnValue(auth({
        billing: { approved: true, subscriptionStatus: status, trialEndsAt: null, stripePriceId: null },
        entitlement: { state: status === "canceled" ? "canceled" : "expired", plan: null, hasOwnerAccess: false, memberLimit: 100, unknownPrice: false },
      }));
      render(<BillingClient />);
      expect(screen.getAllByRole("button", { name: "Subscribe" }), status).toHaveLength(2);
    }
  });

  it("unknown-price active shows the reconciliation banner and portal controls", () => {
    mocks.useAuth.mockReturnValue(auth({
      billing: { approved: true, subscriptionStatus: "active", trialEndsAt: null, stripePriceId: "price_rogue" },
      entitlement: { state: "active", plan: null, hasOwnerAccess: true, memberLimit: 100, unknownPrice: true },
    }));
    render(<BillingClient />);
    expect(screen.getByText(/Plan Unrecognized/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Subscribe" })).toBeNull();
    expect(screen.queryByText("Current Plan")).toBeNull(); // no fabricated plan highlight
  });

  it("legacy free gyms see the legacy banner and CAN subscribe", () => {
    mocks.useAuth.mockReturnValue(auth({
      billing: { approved: true, subscriptionStatus: "free", trialEndsAt: null, stripePriceId: null },
      entitlement: { state: "legacy_free", plan: "basic", hasOwnerAccess: true, memberLimit: 100, unknownPrice: false },
    }));
    render(<BillingClient />);
    expect(screen.getByText("Legacy Free Plan")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Subscribe" })).toHaveLength(2);
  });
});

describe("BillingClient — error handling and loading recovery", () => {
  it("announces a server error in the alert region and re-enables the buttons", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Subscriptions are not available right now. Please contact support." }),
    });
    render(<BillingClient />);
    const [subscribeBasic] = screen.getAllByRole("button", { name: "Subscribe" });
    fireEvent.click(subscribeBasic);
    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain("Subscriptions are not available");
    });
    expect((subscribeBasic as HTMLButtonElement).disabled).toBe(false); // loading cleared
  });

  it("announces a network failure and recovers", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("offline"));
    render(<BillingClient />);
    fireEvent.click(screen.getAllByRole("button", { name: "Subscribe" })[0]);
    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain("Could not reach billing");
    });
  });

  it("buttons disable while a request is pending (double-submit protection)", async () => {
    let resolveFetch: (v: unknown) => void;
    (fetch as ReturnType<typeof vi.fn>).mockReturnValue(new Promise((r) => { resolveFetch = r; }));
    render(<BillingClient />);
    const buttons = screen.getAllByRole("button", { name: "Subscribe" });
    fireEvent.click(buttons[0]);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Redirecting..." })).toBeTruthy();
    });
    expect(buttons.every((b) => (b as HTMLButtonElement).disabled)).toBe(true);
    resolveFetch!({ ok: false, json: async () => ({ error: "x" }) });
  });
});
