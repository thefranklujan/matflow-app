// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import React from "react";
import BillingReturnNotice, { readReturnKind } from "./BillingReturnNotice";

function setup(props: Partial<React.ComponentProps<typeof BillingReturnNotice>> = {}) {
  const refresh = props.refresh ?? vi.fn().mockResolvedValue(undefined);
  const onOpenPortal = props.onOpenPortal ?? vi.fn();
  const utils = render(
    <BillingReturnNotice
      status={props.status ?? null}
      refresh={refresh}
      onOpenPortal={onOpenPortal}
      initialSearch={props.initialSearch ?? "?success=true"}
      pollIntervalMs={props.pollIntervalMs ?? 1000}
      maxPolls={props.maxPolls ?? 3}
    />,
  );
  return { ...utils, refresh, onOpenPortal };
}

beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
afterEach(() => { cleanup(); vi.useRealTimers(); vi.clearAllMocks(); });

describe("readReturnKind", () => {
  it("recognizes only the exact expected values", () => {
    expect(readReturnKind("?success=true")).toBe("success");
    expect(readReturnKind("?canceled=true")).toBe("canceled");
    expect(readReturnKind("?success=false")).toBeNull();
    expect(readReturnKind("?canceled=1")).toBeNull();
    expect(readReturnKind("")).toBeNull();
    expect(readReturnKind("?other=true")).toBeNull();
  });
});

describe("BillingReturnNotice", () => {
  it("renders nothing without a return parameter", () => {
    const { container } = setup({ initialSearch: "" });
    expect(container.innerHTML).toBe("");
  });

  // The central claim of this packet: arriving with success=true is not proof
  // of payment, so the UI must not say it is.
  it("success=true with an unsettled status shows PROCESSING, never 'paid'", () => {
    setup({ status: "trialing" });
    expect(screen.getByText("Finishing your subscription")).toBeTruthy();
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/subscription active/i);
    expect(text).not.toMatch(/payment (is )?confirmed/i);
  });

  it("confirms active only once the SERVER reports active", () => {
    setup({ status: "active" });
    expect(screen.getByText("Subscription active")).toBeTruthy();
  });

  it("polls the server while waiting, and stops at the bound", async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    setup({ status: "trialing", refresh, pollIntervalMs: 1000, maxPolls: 3 });

    for (let i = 0; i < 3; i++) await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(refresh).toHaveBeenCalledTimes(3);

    // Bounded: further time passes without more polling.
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(refresh).toHaveBeenCalledTimes(3);
  });

  it("after the bound, offers portal recovery and warns against a second checkout", async () => {
    setup({ status: "trialing", pollIntervalMs: 1000, maxPolls: 2 });
    for (let i = 0; i < 2; i++) await act(async () => { await vi.advanceTimersByTimeAsync(1000); });

    expect(screen.getByText("Still confirming your payment")).toBeTruthy();
    expect(document.body.textContent).toMatch(/do not start a second checkout/i);
  });

  it("the recovery action opens the portal, never a new checkout", async () => {
    const onOpenPortal = vi.fn();
    setup({ status: "trialing", onOpenPortal, pollIntervalMs: 1000, maxPolls: 1 });
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });

    screen.getByRole("button", { name: /open billing management/i }).click();
    expect(onOpenPortal).toHaveBeenCalledOnce();
  });

  it("a settled but unpaid status says so plainly instead of implying success", () => {
    for (const status of ["past_due", "unpaid", "canceled"]) {
      const { unmount } = setup({ status });
      expect(screen.getByText("Payment needs attention"), status).toBeTruthy();
      expect(document.body.textContent).not.toMatch(/subscription active/i);
      unmount();
    }
  });

  it("does not poll when the status is already settled", async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    setup({ status: "active", refresh });
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(refresh).not.toHaveBeenCalled();
  });

  it("canceled=true states only what is known and makes no Stripe claim", () => {
    setup({ initialSearch: "?canceled=true", status: "trialing" });
    expect(screen.getByText("Checkout canceled")).toBeTruthy();
    const text = document.body.textContent ?? "";
    expect(text).toMatch(/your plan has not changed/i);
    // We never verified Stripe-side payment state, so we must not assert it.
    expect(text).not.toMatch(/no payment was taken|you were not charged|refund/i);
  });

  it("canceled never polls the server", async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    setup({ initialSearch: "?canceled=true", status: "trialing", refresh });
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(refresh).not.toHaveBeenCalled();
  });

  it("strips the return parameters so a reload cannot replay the banner", () => {
    const replaceState = vi.fn();
    const original = window.history.replaceState;
    // @ts-expect-error test double
    window.history.replaceState = replaceState;
    window.history.pushState({}, "", "/app/billing?success=true&keep=1");

    setup({ status: "active", initialSearch: undefined });
    expect(replaceState).toHaveBeenCalled();
    const url = replaceState.mock.calls[0][2] as string;
    expect(url).not.toContain("success=true");
    expect(url).toContain("keep=1");

    window.history.replaceState = original;
  });

  it("every notice is announced to assistive technology", () => {
    for (const [search, status] of [["?success=true", "trialing"], ["?success=true", "active"], ["?canceled=true", "trialing"], ["?success=true", "past_due"]] as const) {
      const { unmount } = setup({ initialSearch: search, status });
      const live = document.querySelector('[role="status"], [role="alert"]');
      expect(live, `${search} ${status}`).not.toBeNull();
      unmount();
    }
  });
});
