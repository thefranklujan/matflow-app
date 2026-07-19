import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  requireOwnerAccess: vi.fn(),
  redirect: vi.fn(),
  getBasicAnalytics: vi.fn(),
  getProAnalytics: vi.fn(),
}));

class RedirectSentinel extends Error {
  constructor(public target: string) { super(`redirect:${target}`); }
}

vi.mock("@/lib/owner-access", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/owner-access")>();
  return { ...actual, requireOwnerAccess: mocks.requireOwnerAccess };
});
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    mocks.redirect(url);
    throw new RedirectSentinel(url); // real redirect() also throws
  },
}));
vi.mock("@/lib/prisma", () => ({ prisma: {} })); // any query would crash loudly
vi.mock("@/lib/analytics-metrics", () => ({
  getBasicAnalytics: mocks.getBasicAnalytics,
  getProAnalytics: mocks.getProAnalytics,
}));

import AnalyticsPage from "./page";
import { EntitlementError } from "@/lib/owner-access";
import { deriveEntitlement } from "@/lib/entitlements";

const lockedEntitlement = deriveEntitlement(
  { subscriptionStatus: "canceled", trialEndsAt: null, stripePriceId: null, approved: true },
);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getBasicAnalytics.mockResolvedValue({});
  mocks.getProAnalytics.mockResolvedValue(null);
});

describe("/app/analytics — server-side owner-access gate", () => {
  it("locked owner: redirected to billing with ZERO analytics queries", async () => {
    mocks.requireOwnerAccess.mockRejectedValue(new EntitlementError("SUBSCRIPTION_REQUIRED", lockedEntitlement));
    await expect(AnalyticsPage()).rejects.toThrow("redirect:/app/billing");
    expect(mocks.redirect).toHaveBeenCalledWith("/app/billing");
    expect(mocks.getBasicAnalytics).not.toHaveBeenCalled();
    expect(mocks.getProAnalytics).not.toHaveBeenCalled();
  });

  it("unauthenticated: redirected to sign-in with zero queries", async () => {
    mocks.requireOwnerAccess.mockRejectedValue(new Error("Unauthorized"));
    await expect(AnalyticsPage()).rejects.toThrow("redirect:/sign-in");
    expect(mocks.getBasicAnalytics).not.toHaveBeenCalled();
  });

  it("Basic owner: fetches Basic only, never Pro", async () => {
    mocks.requireOwnerAccess.mockResolvedValue({
      gymId: "gym_1",
      entitlement: { state: "trialing", plan: "basic", hasOwnerAccess: true, memberLimit: 100, unknownPrice: false, pendingApproval: false },
    });
    mocks.getBasicAnalytics.mockResolvedValue({
      totalMembers: 1, newThisMonth: 0, newLastMonth: 0, attendanceThisMonth: 0,
      attendanceLastMonth: 0, classSessionsThisMonth: 0, avgCheckinsPerSession: 0,
      beltDistribution: [], topClasses: [],
    });
    await AnalyticsPage();
    expect(mocks.getBasicAnalytics).toHaveBeenCalledTimes(1);
    expect(mocks.getProAnalytics).not.toHaveBeenCalled();
  });

  it("Pro owner: fetches both", async () => {
    mocks.requireOwnerAccess.mockResolvedValue({
      gymId: "gym_1",
      entitlement: { state: "active", plan: "pro", hasOwnerAccess: true, memberLimit: null, unknownPrice: false, pendingApproval: false },
    });
    mocks.getBasicAnalytics.mockResolvedValue({
      totalMembers: 1, newThisMonth: 0, newLastMonth: 0, attendanceThisMonth: 0,
      attendanceLastMonth: 0, classSessionsThisMonth: 0, avgCheckinsPerSession: 0,
      beltDistribution: [], topClasses: [],
    });
    mocks.getProAnalytics.mockResolvedValue({ weeklyAttendance: [], memberGrowth: [], inactivityRisk: [] });
    await AnalyticsPage();
    expect(mocks.getProAnalytics).toHaveBeenCalledTimes(1);
  });
});
