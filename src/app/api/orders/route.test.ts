import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthContext: vi.fn(),
  requireAdmin: vi.fn(),
  variantFindMany: vi.fn(),
  gymFindUnique: vi.fn(),
  orderFindMany: vi.fn(),
  txUpdateMany: vi.fn(),
  txOrderCreate: vi.fn(),
  transaction: vi.fn(),
  sendOrderConfirmation: vi.fn(),
  logActivity: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getAuthContext: mocks.getAuthContext,
  requireAdmin: mocks.requireAdmin,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    productVariant: { findMany: mocks.variantFindMany },
    gym: { findUnique: mocks.gymFindUnique },
    order: { findMany: mocks.orderFindMany },
    $transaction: mocks.transaction,
  },
}));
vi.mock("@/lib/email", () => ({ sendOrderConfirmation: mocks.sendOrderConfirmation }));
vi.mock("@/lib/activity-log", () => ({ logActivity: mocks.logActivity }));

import { POST } from "./route";

function req(body: unknown) {
  return new Request("http://localhost/api/orders", {
    method: "POST",
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;
}

const VARIANT = {
  id: "var_1",
  stock: 5,
  productId: "prod_1",
  product: { id: "prod_1", price: 60 },
};

function orderBody(items: unknown[]) {
  return { customerName: "Test", customerEmail: "t@example.com", items };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAuthContext.mockResolvedValue({ gymId: "gym_1" });
  mocks.variantFindMany.mockResolvedValue([VARIANT]);
  mocks.gymFindUnique.mockResolvedValue({ name: "Test Gym" });
  mocks.txUpdateMany.mockResolvedValue({ count: 1 });
  mocks.txOrderCreate.mockImplementation(async (args: { data: unknown }) => ({ id: "ord_1", items: [], ...(args.data as object) }));
  mocks.transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn({ productVariant: { updateMany: mocks.txUpdateMany }, order: { create: mocks.txOrderCreate } }),
  );
});

describe("POST /api/orders — tenant safety and validation", () => {
  it("derives the price server-side, ignoring any client-sent unitPrice", async () => {
    const res = await POST(req(orderBody([{ productId: "prod_1", variantId: "var_1", quantity: 2, unitPrice: 0.01 }])));
    expect(res.status).toBe(201);
    const created = mocks.txOrderCreate.mock.calls[0][0].data;
    expect(created.subtotal).toBe(120); // 2 x server price 60, not client 0.01
  });

  it("scopes the variant lookup to the authenticated gym's active products", async () => {
    await POST(req(orderBody([{ productId: "prod_1", variantId: "var_1", quantity: 1 }])));
    expect(mocks.variantFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ product: { gymId: "gym_1", active: true } }) }),
    );
  });

  it("rejects a cross-tenant/unknown variant with 400", async () => {
    mocks.variantFindMany.mockResolvedValue([]); // not found for THIS gym
    const res = await POST(req(orderBody([{ productId: "prod_x", variantId: "var_other_gym", quantity: 1 }])));
    expect(res.status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects mismatched product/variant pairing with 400", async () => {
    const res = await POST(req(orderBody([{ productId: "prod_WRONG", variantId: "var_1", quantity: 1 }])));
    expect(res.status).toBe(400);
  });

  it("rejects non-positive and non-integer quantities with 400", async () => {
    for (const quantity of [0, -1, 1.5, "9"]) {
      const res = await POST(req(orderBody([{ productId: "prod_1", variantId: "var_1", quantity }])));
      expect(res.status, String(quantity)).toBe(400);
    }
  });

  it("aggregates split lines so they cannot dodge the stock check (409)", async () => {
    // stock 5; two lines of 3 = 6 total for the same variant
    const res = await POST(
      req(orderBody([
        { productId: "prod_1", variantId: "var_1", quantity: 3 },
        { productId: "prod_1", variantId: "var_1", quantity: 3 },
      ])),
    );
    expect(res.status).toBe(409);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});

describe("POST /api/orders — concurrency-safe stock decrement", () => {
  it("uses a CONDITIONAL decrement (stock >= qty) inside the transaction", async () => {
    await POST(req(orderBody([{ productId: "prod_1", variantId: "var_1", quantity: 2 }])));
    expect(mocks.txUpdateMany).toHaveBeenCalledWith({
      where: { id: "var_1", stock: { gte: 2 } },
      data: { stock: { decrement: 2 } },
    });
  });

  it("409 and NO order when the conditional update matches no row (lost the race)", async () => {
    // Pre-check passes (stock 5) but another order drained stock before the
    // transaction's guarded update ran.
    mocks.txUpdateMany.mockResolvedValue({ count: 0 });
    const res = await POST(req(orderBody([{ productId: "prod_1", variantId: "var_1", quantity: 2 }])));
    expect(res.status).toBe(409);
    expect(mocks.txOrderCreate).not.toHaveBeenCalled();
    expect(mocks.sendOrderConfirmation).not.toHaveBeenCalled();
  });

  it("decrements before creating the order so a failed guard rolls everything back", async () => {
    const calls: string[] = [];
    mocks.txUpdateMany.mockImplementation(async () => { calls.push("decrement"); return { count: 1 }; });
    mocks.txOrderCreate.mockImplementation(async (args: { data: unknown }) => { calls.push("create"); return { id: "o", items: [], ...(args.data as object) }; });
    await POST(req(orderBody([{ productId: "prod_1", variantId: "var_1", quantity: 1 }])));
    expect(calls).toEqual(["decrement", "create"]);
  });
});
