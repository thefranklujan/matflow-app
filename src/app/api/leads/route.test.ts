import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePlan: vi.fn(),
  gymHasPlanFeature: vi.fn(),
  leadFindMany: vi.fn(),
  leadCreate: vi.fn(),
  gymFindUnique: vi.fn(),
  gymFindFirst: vi.fn(),
}));

vi.mock("@/lib/owner-access", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/owner-access")>();
  return {
    ...actual,
    requirePlan: mocks.requirePlan,
    gymHasPlanFeature: mocks.gymHasPlanFeature,
  };
});
vi.mock("@/lib/prisma", () => ({
  prisma: {
    lead: { findMany: mocks.leadFindMany, create: mocks.leadCreate },
    gym: { findUnique: mocks.gymFindUnique, findFirst: mocks.gymFindFirst },
  },
}));

import { GET, POST } from "./route";
import { EntitlementError } from "@/lib/owner-access";
import { deriveEntitlement } from "@/lib/entitlements";

function post(body: unknown) {
  return new Request("http://localhost/api/leads", {
    method: "POST",
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;
}

const lockedEntitlement = deriveEntitlement(
  { subscriptionStatus: "canceled", trialEndsAt: null, stripePriceId: null, approved: true },
);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requirePlan.mockResolvedValue({ gymId: "gym_1" });
  mocks.gymHasPlanFeature.mockResolvedValue(true);
  mocks.leadFindMany.mockResolvedValue([]);
  mocks.leadCreate.mockResolvedValue({ id: "lead_1" });
  mocks.gymFindUnique.mockResolvedValue({ id: "gym_1", slug: "test-gym" });
});

describe("GET /api/leads — Pro-only admin read", () => {
  it("200 for a Pro gym", async () => {
    expect((await GET()).status).toBe(200);
    expect(mocks.requirePlan).toHaveBeenCalledWith("pro");
  });

  it("402 PRO_REQUIRED for Basic/trialing/legacy-free admins", async () => {
    mocks.requirePlan.mockRejectedValue(new EntitlementError("PRO_REQUIRED", lockedEntitlement));
    const res = await GET();
    expect(res.status).toBe(402);
    expect((await res.json()).code).toBe("PRO_REQUIRED");
  });

  it("401 for unauthenticated", async () => {
    mocks.requirePlan.mockRejectedValue(new Error("Unauthorized"));
    expect((await GET()).status).toBe(401);
  });
});

describe("POST /api/leads — public capture derives the academy server-side", () => {
  const body = { firstName: "A", lastName: "B", email: "a@b.co", gymSlug: "test-gym" };

  it("creates the lead for a Pro academy", async () => {
    const res = await POST(post(body));
    expect(res.status).toBe(201);
    expect(mocks.gymHasPlanFeature).toHaveBeenCalledWith("gym_1", "pro");
  });

  it("declines generically for a non-Pro academy — no billing details leaked", async () => {
    mocks.gymHasPlanFeature.mockResolvedValue(false);
    const res = await POST(post(body));
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe("This academy is not accepting inquiries right now.");
    expect(JSON.stringify(json)).not.toMatch(/plan|pro|subscription|billing|upgrade/i);
    expect(mocks.leadCreate).not.toHaveBeenCalled();
  });

  it("404 for an unknown academy slug", async () => {
    mocks.gymFindUnique.mockResolvedValue(null);
    expect((await POST(post(body))).status).toBe(404);
  });
});
