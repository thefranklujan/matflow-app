/**
 * Sandbox catalog matching and validation.
 *
 * Pure logic, so the rules that decide "is this the catalog we meant?" are
 * unit-tested rather than discovered against a live sandbox.
 *
 * Two constraints come straight from Stripe's Customer Portal documentation and
 * drive the whole shape of the catalog:
 *
 *   - Two prices cannot share a product AND a recurring interval, so Basic and
 *     Pro must be SEPARATE products or the portal cannot offer a switch.
 *   - A price whose tax_behavior is `unspecified` cannot be switched at all,
 *     and a switch requires both prices to agree, so both must be explicitly
 *     inclusive or both exclusive.
 */

/** The published offer. These are the only amounts this tooling will accept. */
export const BASIC_UNIT_AMOUNT = 4900;
export const PRO_UNIT_AMOUNT = 9900;
export const CURRENCY = "usd";
export const INTERVAL = "month";

/** Marks every object this tooling creates, so cleanup can find its own work. */
export const SANDBOX_METADATA_KEY = "matflow_sandbox_qa";
export const SANDBOX_METADATA_VALUE = "v1";

export type PlanKey = "basic" | "pro";

export const PLAN_PRODUCT_NAMES: Record<PlanKey, string> = {
  basic: "MatFlow Basic",
  pro: "MatFlow Pro",
};

export const PLAN_UNIT_AMOUNTS: Record<PlanKey, number> = {
  basic: BASIC_UNIT_AMOUNT,
  pro: PRO_UNIT_AMOUNT,
};

/** The subset of a Stripe Price this module reasons about. */
export interface PriceShape {
  id: string;
  active: boolean;
  currency: string;
  unit_amount: number | null;
  recurring: { interval: string } | null;
  tax_behavior?: string | null;
  product: string;
}

export interface CatalogProblem {
  code:
    | "NO_MATCH"
    | "AMBIGUOUS"
    | "WRONG_AMOUNT"
    | "WRONG_CURRENCY"
    | "WRONG_INTERVAL"
    | "INACTIVE"
    | "TAX_BEHAVIOR_UNSPECIFIED"
    | "TAX_BEHAVIOR_MISMATCH"
    | "SHARED_PRODUCT"
    | "SAME_PRICE";
  message: string;
}

/** Does this price match what the named plan is supposed to be? */
export function priceMatchesPlan(price: PriceShape, plan: PlanKey): boolean {
  return (
    price.active &&
    price.currency?.toLowerCase() === CURRENCY &&
    price.unit_amount === PLAN_UNIT_AMOUNTS[plan] &&
    price.recurring?.interval === INTERVAL
  );
}

/**
 * Pick the single price for a plan from a candidate list.
 *
 * Ambiguity is an error, never a coin flip: if two active prices both look
 * correct, a human has to say which one is canonical before anything is
 * created against it.
 */
export function selectPlanPrice(
  candidates: PriceShape[],
  plan: PlanKey,
): { price: PriceShape | null; problem: CatalogProblem | null } {
  const matches = candidates.filter((p) => priceMatchesPlan(p, plan));
  if (matches.length === 1) return { price: matches[0], problem: null };
  if (matches.length === 0) {
    return {
      price: null,
      problem: { code: "NO_MATCH", message: `No active ${plan} price at the expected amount, currency, and interval.` },
    };
  }
  return {
    price: null,
    problem: {
      code: "AMBIGUOUS",
      message: `More than one active ${plan} price matches. Reconcile the sandbox catalog before continuing.`,
    },
  };
}

/**
 * Validate a resolved Basic/Pro pair as a portal-switchable catalog.
 *
 * Every problem is collected rather than stopping at the first, so one run
 * tells the whole story.
 */
export function validateCatalogPair(basic: PriceShape, pro: PriceShape): CatalogProblem[] {
  const problems: CatalogProblem[] = [];

  const checks: Array<[PlanKey, PriceShape]> = [["basic", basic], ["pro", pro]];
  for (const [plan, price] of checks) {
    if (!price.active) problems.push({ code: "INACTIVE", message: `The ${plan} price is not active.` });
    if (price.currency?.toLowerCase() !== CURRENCY) {
      problems.push({ code: "WRONG_CURRENCY", message: `The ${plan} price is not in ${CURRENCY.toUpperCase()}.` });
    }
    if (price.unit_amount !== PLAN_UNIT_AMOUNTS[plan]) {
      problems.push({ code: "WRONG_AMOUNT", message: `The ${plan} price does not match the published amount.` });
    }
    if (price.recurring?.interval !== INTERVAL) {
      problems.push({ code: "WRONG_INTERVAL", message: `The ${plan} price is not billed monthly.` });
    }
    if (!price.tax_behavior || price.tax_behavior === "unspecified") {
      problems.push({
        code: "TAX_BEHAVIOR_UNSPECIFIED",
        message: `The ${plan} price has unspecified tax behavior, so the portal cannot switch it.`,
      });
    }
  }

  if (
    basic.tax_behavior &&
    pro.tax_behavior &&
    basic.tax_behavior !== "unspecified" &&
    pro.tax_behavior !== "unspecified" &&
    basic.tax_behavior !== pro.tax_behavior
  ) {
    problems.push({
      code: "TAX_BEHAVIOR_MISMATCH",
      message: "Basic and Pro have different tax behavior, so a portal switch between them is rejected.",
    });
  }

  if (basic.id === pro.id) {
    problems.push({ code: "SAME_PRICE", message: "Basic and Pro resolve to the same price." });
  }

  // The portal constraint that forces separate products.
  if (basic.product && basic.product === pro.product) {
    problems.push({
      code: "SHARED_PRODUCT",
      message: "Basic and Pro share one product; Stripe cannot offer a monthly switch between them.",
    });
  }

  return problems;
}

/** Metadata stamped on every sandbox object this tooling creates. */
export function sandboxMetadata(plan: PlanKey): Record<string, string> {
  return { [SANDBOX_METADATA_KEY]: SANDBOX_METADATA_VALUE, matflow_plan: plan };
}

/** Was this object created by this tooling? Used to scope cleanup. */
export function isSandboxOwned(metadata: Record<string, string> | null | undefined): boolean {
  return metadata?.[SANDBOX_METADATA_KEY] === SANDBOX_METADATA_VALUE;
}
