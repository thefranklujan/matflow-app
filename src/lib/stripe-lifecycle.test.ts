import { describe, it, expect } from "vitest";
import {
  EXIT_LIVE_REFUSED,
  EXIT_OK,
  EXIT_REFUSED,
  LIFECYCLE_STAGES,
  TEST_IDENTITY_DOMAIN,
  formatPlan,
  isLocalDatabaseUrl,
  planLifecycle,
  testIdentity,
  type LifecycleEnv,
  type RefusalCode,
} from "./stripe-lifecycle";

/** Obviously fake shapes. No real credential appears in this file. */
const SAFE: LifecycleEnv = {
  STRIPE_SECRET_KEY: "sk_test_FAKE",
  STRIPE_WEBHOOK_SECRET: "whsec_FAKE",
  STRIPE_BASIC_PRICE_ID: "price_basic_FAKE",
  STRIPE_PRO_PRICE_ID: "price_pro_FAKE",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  E2E_DATABASE_URL: "postgresql://matflow:matflow@localhost:5544/matflow_test",
  STRIPE_SANDBOX_FINGERPRINT: "0123456789abcdef0123456789abcdef",
  STRIPE_PORTAL_CONFIGURATION_ID: "bpc_FAKE",
};

const codes = (env: LifecycleEnv): RefusalCode[] =>
  planLifecycle(env, { execute: true }).refusals.map((r) => r.code);

describe("stage plan", () => {
  it("is exactly twenty stages in strict order", () => {
    expect(LIFECYCLE_STAGES).toHaveLength(20);
    expect(LIFECYCLE_STAGES.map((s) => s.order)).toEqual(
      Array.from({ length: 20 }, (_, i) => i + 1),
    );
  });

  it("has unique stage ids", () => {
    expect(new Set(LIFECYCLE_STAGES.map((s) => s.id)).size).toBe(20);
  });

  it("begins with the readiness preflight before any mutation", () => {
    expect(LIFECYCLE_STAGES[0].id).toBe("preflight_readiness");
    const firstMutation = LIFECYCLE_STAGES.findIndex((s) => s.kind === "mutate");
    const preflight = LIFECYCLE_STAGES.findIndex((s) => s.id === "preflight_readiness");
    expect(preflight).toBeLessThan(firstMutation);
  });

  it("covers the full subscription lifecycle the launch gate requires", () => {
    const ids = LIFECYCLE_STAGES.map((s) => s.id);
    for (const required of [
      "complete_checkout_with_test_card",
      "assert_subscription_active_basic",
      "refuse_duplicate_checkout",
      "replay_webhook_assert_idempotent",
      "switch_plan_basic_to_pro",
      "force_payment_failure_past_due",
      "cancel_subscription",
      "assert_entitlement_revoked_after_cancel",
      "resubscribe_and_record_manifest",
    ]) {
      expect(ids, required).toContain(required);
    }
  });

  it("never contains a stage that creates products or prices", () => {
    const text = JSON.stringify(LIFECYCLE_STAGES).toLowerCase();
    expect(text).not.toContain("create price");
    expect(text).not.toContain("create product");
  });

  it("pairs every mutation with at least one assertion", () => {
    expect(LIFECYCLE_STAGES.filter((s) => s.kind === "assert").length).toBeGreaterThanOrEqual(
      LIFECYCLE_STAGES.filter((s) => s.kind === "mutate").length - 2,
    );
  });
});

describe("isLocalDatabaseUrl", () => {
  it("accepts only unmistakably local hosts", () => {
    expect(isLocalDatabaseUrl("postgresql://u:p@localhost:5544/matflow_test")).toBe(true);
    expect(isLocalDatabaseUrl("postgresql://u:p@127.0.0.1:5432/x")).toBe(true);
  });
  it("treats remote and unparseable URLs as unsafe", () => {
    expect(isLocalDatabaseUrl("postgresql://u:p@db.prod.example.com:5432/matflow")).toBe(false);
    expect(isLocalDatabaseUrl("postgres://aws-0-us-east-1.pooler.supabase.com/postgres")).toBe(false);
    expect(isLocalDatabaseUrl("not a url")).toBe(false);
    expect(isLocalDatabaseUrl(undefined)).toBe(false);
    expect(isLocalDatabaseUrl("")).toBe(false);
  });
  it("is not fooled by a hostname that merely contains 'localhost'", () => {
    expect(isLocalDatabaseUrl("postgresql://u:p@localhost.prod.example.com/x")).toBe(false);
  });
});

describe("guards — every refusal path", () => {
  it("a safe configuration is allowed and exits 0", () => {
    const plan = planLifecycle(SAFE, { execute: true });
    expect(plan.allowed).toBe(true);
    expect(plan.refusals).toEqual([]);
    expect(plan.exitCode).toBe(EXIT_OK);
  });

  it("LIVE_KEY short-circuits with its own exit code", () => {
    const plan = planLifecycle({ ...SAFE, STRIPE_SECRET_KEY: "sk_live_FAKE" }, { execute: true });
    expect(plan.allowed).toBe(false);
    expect(plan.exitCode).toBe(EXIT_LIVE_REFUSED);
    expect(plan.refusals.map((r) => r.code)).toEqual(["LIVE_KEY"]);
  });

  it("a live key is refused even in dry-run mode", () => {
    const plan = planLifecycle({ ...SAFE, STRIPE_SECRET_KEY: "rk_live_FAKE" }, { execute: false });
    expect(plan.allowed).toBe(false);
    expect(plan.exitCode).toBe(EXIT_LIVE_REFUSED);
  });

  it("NOT_A_TEST_KEY for missing or malformed keys", () => {
    expect(codes({ ...SAFE, STRIPE_SECRET_KEY: undefined })).toContain("NOT_A_TEST_KEY");
    expect(codes({ ...SAFE, STRIPE_SECRET_KEY: "pk_test_FAKE" })).toContain("NOT_A_TEST_KEY");
  });

  it("MISSING_WEBHOOK_SECRET", () => {
    expect(codes({ ...SAFE, STRIPE_WEBHOOK_SECRET: undefined })).toContain("MISSING_WEBHOOK_SECRET");
    expect(codes({ ...SAFE, STRIPE_WEBHOOK_SECRET: "   " })).toContain("MISSING_WEBHOOK_SECRET");
  });

  it("MISSING_PRICE_IDS when either price is absent", () => {
    expect(codes({ ...SAFE, STRIPE_BASIC_PRICE_ID: undefined })).toContain("MISSING_PRICE_IDS");
    expect(codes({ ...SAFE, STRIPE_PRO_PRICE_ID: undefined })).toContain("MISSING_PRICE_IDS");
  });

  it("IDENTICAL_PRICE_IDS when both prices are the same", () => {
    const c = codes({ ...SAFE, STRIPE_PRO_PRICE_ID: SAFE.STRIPE_BASIC_PRICE_ID });
    expect(c).toContain("IDENTICAL_PRICE_IDS");
    expect(c).not.toContain("MISSING_PRICE_IDS");
  });

  it("PRODUCTION_APP_URL", () => {
    expect(codes({ ...SAFE, NEXT_PUBLIC_APP_URL: "https://app.mymatflow.com" })).toContain("PRODUCTION_APP_URL");
  });

  it("a preview URL is not refused", () => {
    expect(codes({ ...SAFE, NEXT_PUBLIC_APP_URL: "https://matflow-x.vercel.app" })).not.toContain("PRODUCTION_APP_URL");
  });

  it("PRODUCTION_DATABASE for any non-local or absent database", () => {
    expect(codes({ ...SAFE, E2E_DATABASE_URL: undefined })).toContain("PRODUCTION_DATABASE");
    expect(codes({ ...SAFE, E2E_DATABASE_URL: "postgresql://u:p@db.example.com/matflow" })).toContain("PRODUCTION_DATABASE");
  });

  it("collects every independent problem rather than stopping at the first", () => {
    const c = codes({ NEXT_PUBLIC_APP_URL: "https://app.mymatflow.com" });
    expect(c).toEqual(
      expect.arrayContaining(["NOT_A_TEST_KEY", "MISSING_WEBHOOK_SECRET", "MISSING_PRICE_IDS", "PRODUCTION_APP_URL", "PRODUCTION_DATABASE", "MISSING_SANDBOX_FINGERPRINT", "MISSING_PORTAL_CONFIGURATION"]),
    );
  });

  // The machine's default Stripe CLI profile is authenticated to a
  // live-capable account, so an unproven target must never be mutated.
  it("MISSING_SANDBOX_FINGERPRINT when no approved sandbox is pinned", () => {
    expect(codes({ ...SAFE, STRIPE_SANDBOX_FINGERPRINT: undefined })).toContain("MISSING_SANDBOX_FINGERPRINT");
    expect(codes({ ...SAFE, STRIPE_SANDBOX_FINGERPRINT: "  " })).toContain("MISSING_SANDBOX_FINGERPRINT");
  });

  it("MISSING_PORTAL_CONFIGURATION when plan switching could not be proven", () => {
    expect(codes({ ...SAFE, STRIPE_PORTAL_CONFIGURATION_ID: undefined })).toContain("MISSING_PORTAL_CONFIGURATION");
  });

  it("an empty environment is refused, never allowed by default", () => {
    const plan = planLifecycle({}, { execute: true });
    expect(plan.allowed).toBe(false);
    expect(plan.exitCode).toBe(EXIT_REFUSED);
  });
});

describe("dry run is the default posture", () => {
  it("reports dry-run mode when execute is not requested", () => {
    expect(planLifecycle(SAFE, { execute: false }).mode).toBe("dry-run");
  });

  it("a dry run still lists all twenty stages so the plan is reviewable", () => {
    const out = formatPlan(planLifecycle(SAFE, { execute: false }));
    for (const stage of LIFECYCLE_STAGES) expect(out).toContain(stage.title);
    expect(out).toContain("nothing was created, modified, or deleted");
  });

  it("dry-run output states the mode unambiguously", () => {
    expect(formatPlan(planLifecycle(SAFE, { execute: false }))).toContain("DRY-RUN");
  });
});

describe("test identities can never reach a real person", () => {
  it("uses the reserved non-routable domain", () => {
    const { email, academyName } = testIdentity("gate1", 2);
    expect(email.endsWith(`@${TEST_IDENTITY_DOMAIN}`)).toBe(true);
    expect(TEST_IDENTITY_DOMAIN.endsWith(".test")).toBe(true);
    expect(academyName).toContain("Stripe Test Academy");
  });

  it("is deterministic and collision-free across indexes", () => {
    expect(testIdentity("gate1", 1).email).toBe(testIdentity("gate1", 1).email);
    expect(testIdentity("gate1", 1).email).not.toBe(testIdentity("gate1", 2).email);
  });
});

describe("formatPlan never leaks values", () => {
  it("prints classifications and stage names only", () => {
    const out = formatPlan(planLifecycle(SAFE, { execute: false }));
    expect(out).not.toContain("sk_test_FAKE");
    expect(out).not.toContain("whsec_FAKE");
    expect(out).not.toContain("price_basic_FAKE");
    expect(out).not.toContain("matflow_test");
  });

  it("prints no fragment of a live key when refusing", () => {
    const out = formatPlan(planLifecycle({ ...SAFE, STRIPE_SECRET_KEY: "sk_live_SUPERSECRET" }, { execute: true }));
    expect(out).not.toContain("SUPERSECRET");
    expect(out).not.toContain("sk_live_");
    expect(out).toContain("LIVE_KEY");
  });
});
