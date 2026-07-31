import { describe, it, expect } from "vitest";
import {
  BASIC_UNIT_AMOUNT,
  PRO_UNIT_AMOUNT,
  isSandboxOwned,
  priceMatchesPlan,
  sandboxMetadata,
  selectPlanPrice,
  validateCatalogPair,
  type PriceShape,
} from "./stripe-catalog";

function price(over: Partial<PriceShape> = {}): PriceShape {
  return {
    id: "price_basic_FAKE",
    active: true,
    currency: "usd",
    unit_amount: BASIC_UNIT_AMOUNT,
    recurring: { interval: "month" },
    tax_behavior: "exclusive",
    product: "prod_basic_FAKE",
    ...over,
  };
}

const proPrice = (over: Partial<PriceShape> = {}) =>
  price({ id: "price_pro_FAKE", unit_amount: PRO_UNIT_AMOUNT, product: "prod_pro_FAKE", ...over });

describe("priceMatchesPlan holds the published offer", () => {
  it("accepts the exact published Basic and Pro prices", () => {
    expect(priceMatchesPlan(price(), "basic")).toBe(true);
    expect(priceMatchesPlan(proPrice(), "pro")).toBe(true);
  });

  it("rejects a price at the wrong amount, even by a cent", () => {
    expect(priceMatchesPlan(price({ unit_amount: 4899 }), "basic")).toBe(false);
    expect(priceMatchesPlan(price({ unit_amount: 9900 }), "basic")).toBe(false);
  });

  it("rejects non-USD, non-monthly, one-off, and inactive prices", () => {
    expect(priceMatchesPlan(price({ currency: "eur" }), "basic")).toBe(false);
    expect(priceMatchesPlan(price({ recurring: { interval: "year" } }), "basic")).toBe(false);
    expect(priceMatchesPlan(price({ recurring: null }), "basic")).toBe(false);
    expect(priceMatchesPlan(price({ active: false }), "basic")).toBe(false);
  });

  it("is case-insensitive about currency", () => {
    expect(priceMatchesPlan(price({ currency: "USD" }), "basic")).toBe(true);
  });
});

describe("selectPlanPrice refuses to guess", () => {
  it("returns the single match", () => {
    const r = selectPlanPrice([price(), proPrice()], "basic");
    expect(r.price?.id).toBe("price_basic_FAKE");
    expect(r.problem).toBeNull();
  });

  it("reports NO_MATCH rather than falling back to something close", () => {
    const r = selectPlanPrice([price({ unit_amount: 5900 })], "basic");
    expect(r.price).toBeNull();
    expect(r.problem?.code).toBe("NO_MATCH");
  });

  // Picking one arbitrarily would silently bind the test run to the wrong
  // object, which is exactly the reconciliation trap the packet calls out.
  it("reports AMBIGUOUS when two active prices both match", () => {
    const r = selectPlanPrice([price(), price({ id: "price_dupe_FAKE" })], "basic");
    expect(r.price).toBeNull();
    expect(r.problem?.code).toBe("AMBIGUOUS");
  });

  it("ignores inactive duplicates when exactly one is active", () => {
    const r = selectPlanPrice([price(), price({ id: "price_old_FAKE", active: false })], "basic");
    expect(r.price?.id).toBe("price_basic_FAKE");
  });
});

describe("validateCatalogPair enforces the portal constraints", () => {
  it("accepts a correct pair", () => {
    expect(validateCatalogPair(price(), proPrice())).toEqual([]);
  });

  // Stripe forbids two prices sharing a product and recurring interval, so the
  // portal could not offer a switch between them.
  it("rejects Basic and Pro on the SAME product", () => {
    const codes = validateCatalogPair(price(), proPrice({ product: "prod_basic_FAKE" })).map((p) => p.code);
    expect(codes).toContain("SHARED_PRODUCT");
  });

  it("rejects an unspecified tax behavior on either price", () => {
    expect(validateCatalogPair(price({ tax_behavior: "unspecified" }), proPrice()).map((p) => p.code))
      .toContain("TAX_BEHAVIOR_UNSPECIFIED");
    expect(validateCatalogPair(price({ tax_behavior: null }), proPrice()).map((p) => p.code))
      .toContain("TAX_BEHAVIOR_UNSPECIFIED");
    expect(validateCatalogPair(price(), proPrice({ tax_behavior: undefined })).map((p) => p.code))
      .toContain("TAX_BEHAVIOR_UNSPECIFIED");
  });

  it("rejects mismatched tax behavior between the two plans", () => {
    const codes = validateCatalogPair(price({ tax_behavior: "inclusive" }), proPrice({ tax_behavior: "exclusive" }))
      .map((p) => p.code);
    expect(codes).toContain("TAX_BEHAVIOR_MISMATCH");
  });

  it("accepts a matched pair whichever behavior they agree on", () => {
    expect(validateCatalogPair(price({ tax_behavior: "inclusive" }), proPrice({ tax_behavior: "inclusive" }))).toEqual([]);
  });

  it("rejects identical prices for both plans", () => {
    const codes = validateCatalogPair(price(), proPrice({ id: "price_basic_FAKE" })).map((p) => p.code);
    expect(codes).toContain("SAME_PRICE");
  });

  it("collects every problem instead of stopping at the first", () => {
    const codes = validateCatalogPair(
      price({ active: false, currency: "eur", tax_behavior: "unspecified" }),
      proPrice({ unit_amount: 100, recurring: { interval: "year" } }),
    ).map((p) => p.code);
    expect(codes).toEqual(
      expect.arrayContaining(["INACTIVE", "WRONG_CURRENCY", "TAX_BEHAVIOR_UNSPECIFIED", "WRONG_AMOUNT", "WRONG_INTERVAL"]),
    );
  });

  it("no problem message leaks a Stripe identifier", () => {
    for (const p of validateCatalogPair(price({ active: false, tax_behavior: "unspecified" }), proPrice({ product: "prod_basic_FAKE" }))) {
      expect(p.message).not.toMatch(/price_|prod_/);
    }
  });
});

describe("sandbox ownership metadata", () => {
  it("stamps a recognizable marker with the plan", () => {
    const m = sandboxMetadata("pro");
    expect(isSandboxOwned(m)).toBe(true);
    expect(m.matflow_plan).toBe("pro");
  });

  it("does not claim ownership of unmarked or foreign objects", () => {
    expect(isSandboxOwned(undefined)).toBe(false);
    expect(isSandboxOwned(null)).toBe(false);
    expect(isSandboxOwned({})).toBe(false);
    expect(isSandboxOwned({ matflow_sandbox_qa: "v0" })).toBe(false);
    expect(isSandboxOwned({ something_else: "v1" })).toBe(false);
  });
});
