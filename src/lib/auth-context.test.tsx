// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup, act } from "@testing-library/react";
import { AuthProvider, useAuth } from "./auth-context";

function Probe() {
  const { isLockedOut, isPendingApproval, isPlatformAdmin, entitlement, refresh } = useAuth();
  return (
    <div>
      <span data-testid="locked">{String(isLockedOut)}</span>
      <span data-testid="pending">{String(isPendingApproval)}</span>
      <span data-testid="platform">{String(isPlatformAdmin)}</span>
      <span data-testid="state">{entitlement?.state ?? "none"}</span>
      <button onClick={() => refresh()}>refresh</button>
    </div>
  );
}

function sessionResponse(over: Record<string, unknown> = {}) {
  return {
    ok: true,
    json: async () => ({
      user: { email: "o@x.co", name: "O", role: "admin", gymId: "g1", memberId: "m1" },
      gym: { name: "G", logo: null },
      billing: { approved: true, subscriptionStatus: "trialing", trialEndsAt: new Date(Date.now() + 86400000).toISOString(), stripePriceId: null },
      entitlement: { state: "trialing", plan: "basic", hasOwnerAccess: true, memberLimit: 100, unknownPrice: false },
      isPlatformAdmin: false,
      ...over,
    }),
  };
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("AuthProvider — lockout derives from server entitlement", () => {
  it("locks for unpaid/incomplete/paused/unknown states the legacy string check missed", async () => {
    for (const status of ["unpaid", "incomplete", "paused", "something_unknown", "cancelled"]) {
      cleanup();
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(sessionResponse({
        billing: { approved: true, subscriptionStatus: status, trialEndsAt: null, stripePriceId: "price_b" },
        entitlement: { state: "past_due", plan: "basic", hasOwnerAccess: false, memberLimit: 100, unknownPrice: false },
      }));
      render(<AuthProvider><Probe /></AuthProvider>);
      await waitFor(() => expect(screen.getByTestId("locked").textContent, status).toBe("true"));
    }
  });

  it("does not lock a valid trial / active / legacy-free owner", async () => {
    for (const entitlement of [
      { state: "trialing", plan: "basic", hasOwnerAccess: true, memberLimit: 100, unknownPrice: false },
      { state: "active", plan: "pro", hasOwnerAccess: true, memberLimit: null, unknownPrice: false },
      { state: "legacy_free", plan: "basic", hasOwnerAccess: true, memberLimit: 100, unknownPrice: false },
    ]) {
      cleanup();
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(sessionResponse({ entitlement }));
      render(<AuthProvider><Probe /></AuthProvider>);
      await waitFor(() => expect(screen.getByTestId("state").textContent).toBe(entitlement.state));
      expect(screen.getByTestId("locked").textContent).toBe("false");
    }
  });

  it("preserves pending-approval presentation (entitlement also denies access)", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(sessionResponse({
      billing: { approved: false, subscriptionStatus: "trialing", trialEndsAt: null, stripePriceId: null },
      entitlement: { state: "trialing", plan: "basic", hasOwnerAccess: false, memberLimit: 100, unknownPrice: false },
    }));
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId("pending").textContent).toBe("true"));
    expect(screen.getByTestId("locked").textContent).toBe("true");
  });
});

describe("AuthProvider — refresh response classes", () => {
  async function renderSignedIn() {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(sessionResponse({ isPlatformAdmin: true }));
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId("platform").textContent).toBe("true"));
  }

  it("OK with no user clears everything", async () => {
    await renderSignedIn();
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: true, json: async () => ({ user: null }) });
    await act(async () => { screen.getByRole("button", { name: "refresh" }).click(); });
    await waitFor(() => expect(screen.getByTestId("platform").textContent).toBe("false"));
    expect(screen.getByTestId("state").textContent).toBe("none");
  });

  it("401 and 403 clear ALL authentication state", async () => {
    for (const status of [401, 403]) {
      cleanup();
      await renderSignedIn();
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false, status, json: async () => ({}) });
      await act(async () => { screen.getByRole("button", { name: "refresh" }).click(); });
      await waitFor(() => expect(screen.getByTestId("platform").textContent, String(status)).toBe("false"));
      expect(screen.getByTestId("state").textContent, String(status)).toBe("none");
    }
  });

  it("500 preserves current state (transient server trouble)", async () => {
    await renderSignedIn();
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });
    await act(async () => { screen.getByRole("button", { name: "refresh" }).click(); });
    expect(screen.getByTestId("platform").textContent).toBe("true"); // kept
    expect(screen.getByTestId("state").textContent).toBe("trialing");
  });

  it("network failure preserves current state (not logout evidence)", async () => {
    await renderSignedIn();
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("offline"));
    await act(async () => { screen.getByRole("button", { name: "refresh" }).click(); });
    expect(screen.getByTestId("platform").textContent).toBe("true"); // kept
  });
});

describe("AuthProvider — refresh replaces ALL state (no stale truth)", () => {
  it("clears entitlement and platform-admin when a later response omits them", async () => {
    (fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(sessionResponse({ isPlatformAdmin: true }))
      .mockResolvedValueOnce(sessionResponse({
        entitlement: null,
        isPlatformAdmin: false,
        billing: { approved: true, subscriptionStatus: "canceled", trialEndsAt: null, stripePriceId: null },
      }));
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId("platform").textContent).toBe("true"));
    expect(screen.getByTestId("state").textContent).toBe("trialing");

    await act(async () => { screen.getByRole("button", { name: "refresh" }).click(); });

    await waitFor(() => expect(screen.getByTestId("platform").textContent).toBe("false"));
    expect(screen.getByTestId("state").textContent).toBe("none"); // stale entitlement gone
    // Fallback path (no entitlement in response): canceled still locks.
    expect(screen.getByTestId("locked").textContent).toBe("true");
  });
});
