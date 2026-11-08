import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Commerce is switched off (Phase 0 hotfix, owner-features finding 7): order
 * creation answers 410 and never touches stock, orders or email. The previous
 * tenant-safety and stock-decrement suite lives in git history with the
 * implementation it covered.
 */
const mocks = vi.hoisted(() => ({
  getAuthContext: vi.fn(),
  requireAdmin: vi.fn(),
  orderFindMany: vi.fn(),
  transaction: vi.fn(),
  variantFindMany: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getAuthContext: mocks.getAuthContext,
  requireAdmin: mocks.requireAdmin,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: { findMany: mocks.orderFindMany },
    productVariant: { findMany: mocks.variantFindMany },
    $transaction: mocks.transaction,
  },
}));

import { GET, POST } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAuthContext.mockResolvedValue({ gymId: "gym_1" });
  mocks.requireAdmin.mockResolvedValue({ gymId: "gym_1" });
  mocks.orderFindMany.mockResolvedValue([]);
});

describe("POST /api/orders — commerce is off", () => {
  it("answers 410 Gone without reading or writing anything", async () => {
    const res = await POST();
    expect(res.status).toBe(410);
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.variantFindMany).not.toHaveBeenCalled();
    expect(mocks.getAuthContext).not.toHaveBeenCalled();
  });
});

describe("GET /api/orders — historical orders stay readable to the owner", () => {
  it("is scoped to the admin's gym", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(mocks.orderFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { gymId: "gym_1" } }));
  });

  it("refuses a non-admin", async () => {
    mocks.requireAdmin.mockRejectedValue(new Error("Forbidden"));
    expect((await GET()).status).toBe(401);
  });
});
