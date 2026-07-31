import { describe, it, expect } from "vitest";
import {
  EXIT_INCOMPLETE,
  EXIT_LIVE_KEY_REFUSED,
  EXIT_OK,
  classifyAppUrl,
  classifySecretKey,
  evaluateReadiness,
  formatReport,
  isForbiddenEnvFile,
  isPlaceholder,
  unfilledPlaceholderKeys,
} from "./stripe-readiness";

/** Values here are obviously fake shapes, never real credentials. */
const COMPLETE = {
  STRIPE_SECRET_KEY: "sk_test_FAKE",
  STRIPE_WEBHOOK_SECRET: "whsec_FAKE",
  STRIPE_BASIC_PRICE_ID: "price_basic_FAKE",
  STRIPE_PRO_PRICE_ID: "price_pro_FAKE",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
};
const CLI = { stripeCliPresent: true };

describe("classifySecretKey", () => {
  it("recognizes both test key kinds", () => {
    expect(classifySecretKey("sk_test_abc")).toBe("test");
    expect(classifySecretKey("rk_test_abc")).toBe("test");
  });
  it("recognizes both live key kinds", () => {
    expect(classifySecretKey("sk_live_abc")).toBe("live");
    expect(classifySecretKey("rk_live_abc")).toBe("live");
  });
  it("treats absent or malformed keys distinctly", () => {
    expect(classifySecretKey(undefined)).toBe("missing");
    expect(classifySecretKey("")).toBe("missing");
    expect(classifySecretKey("   ")).toBe("missing");
    expect(classifySecretKey("pk_test_abc")).toBe("unrecognized");
    expect(classifySecretKey("nonsense")).toBe("unrecognized");
  });
});

describe("classifyAppUrl", () => {
  it("classifies local, preview, and production", () => {
    expect(classifyAppUrl("http://localhost:3000")).toBe("localhost");
    expect(classifyAppUrl("http://127.0.0.1:4310")).toBe("localhost");
    expect(classifyAppUrl("https://matflow-abc.vercel.app")).toBe("preview");
    expect(classifyAppUrl("https://app.mymatflow.com")).toBe("production");
    expect(classifyAppUrl(undefined)).toBe("missing");
  });
});

describe("isForbiddenEnvFile", () => {
  it("refuses production env files anywhere on the path", () => {
    expect(isForbiddenEnvFile(".env.production")).toBe(true);
    expect(isForbiddenEnvFile("/a/b/.env.production.local")).toBe(true);
    expect(isForbiddenEnvFile(".env.prod")).toBe(true);
  });
  it("allows explicit test files", () => {
    expect(isForbiddenEnvFile(".env.stripe-test")).toBe(false);
    expect(isForbiddenEnvFile(".env.local")).toBe(false);
  });
});

// .env.stripe-test is copied from the example template, so a half-filled file
// is the normal intermediate state. Treating sk_test_REPLACE_ME as a real key
// made the gate report READY with exit 0.
describe("template placeholders are never treated as configured", () => {
  it("recognizes the template markers", () => {
    expect(isPlaceholder("sk_test_REPLACE_ME")).toBe(true);
    expect(isPlaceholder("price_REPLACE_ME_BASIC_49")).toBe(true);
    expect(isPlaceholder("postgresql://USER:PASSWORD@localhost:5544/matflow_test")).toBe(true);
    expect(isPlaceholder("replace_me")).toBe(true);
  });

  it("does not flag real-shaped values", () => {
    expect(isPlaceholder("sk_test_abc123")).toBe(false);
    expect(isPlaceholder("postgresql://matflow:pw@localhost:5544/matflow_test")).toBe(false);
    expect(isPlaceholder(undefined)).toBe(false);
    expect(isPlaceholder("")).toBe(false);
  });

  it("names every unfilled key, sorted", () => {
    expect(unfilledPlaceholderKeys({ B: "REPLACE_ME", A: "sk_test_REPLACE_ME", C: "real" })).toEqual(["A", "B"]);
  });

  it("a fully unfilled template is NOT ready", () => {
    const report = evaluateReadiness(
      {
        STRIPE_SECRET_KEY: "sk_test_REPLACE_ME",
        STRIPE_WEBHOOK_SECRET: "whsec_REPLACE_ME",
        STRIPE_BASIC_PRICE_ID: "price_REPLACE_ME_BASIC_49",
        STRIPE_PRO_PRICE_ID: "price_REPLACE_ME_PRO_99",
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      },
      CLI,
    );
    expect(report.ready).toBe(false);
    expect(report.exitCode).toBe(EXIT_INCOMPLETE);
    expect(report.secretKeyMode).toBe("missing");
  });

  it("distinct placeholder price ids still do not count as distinct prices", () => {
    const report = evaluateReadiness(
      { ...COMPLETE, STRIPE_BASIC_PRICE_ID: "price_REPLACE_ME_BASIC_49", STRIPE_PRO_PRICE_ID: "price_REPLACE_ME_PRO_99" },
      CLI,
    );
    expect(report.ready).toBe(false);
    expect(report.pricesDistinct).toBe(false);
  });
});

describe("evaluateReadiness", () => {
  it("a complete test-mode configuration is ready and exits 0", () => {
    const r = evaluateReadiness(COMPLETE, CLI);
    expect(r.ready).toBe(true);
    expect(r.exitCode).toBe(EXIT_OK);
    expect(r.problems).toEqual([]);
    expect(r.secretKeyMode).toBe("test");
    expect(r.pricesDistinct).toBe(true);
  });

  it("a LIVE key is refused immediately with the distinct code", () => {
    const r = evaluateReadiness({ ...COMPLETE, STRIPE_SECRET_KEY: "sk_live_FAKE" }, CLI);
    expect(r.exitCode).toBe(EXIT_LIVE_KEY_REFUSED);
    expect(r.ready).toBe(false);
    expect(r.problems.join(" ")).toMatch(/LIVE/);
    // The refusal short-circuits: it does not enumerate other problems.
    expect(r.problems).toHaveLength(1);
  });

  it("missing configuration is incomplete, listing each gap", () => {
    const r = evaluateReadiness({}, { stripeCliPresent: false });
    expect(r.exitCode).toBe(EXIT_INCOMPLETE);
    const joined = r.problems.join(" ");
    for (const needle of ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_BASIC_PRICE_ID", "STRIPE_PRO_PRICE_ID", "NEXT_PUBLIC_APP_URL", "Stripe CLI"]) {
      expect(joined, needle).toContain(needle);
    }
  });

  it("malformed key is not treated as usable", () => {
    const r = evaluateReadiness({ ...COMPLETE, STRIPE_SECRET_KEY: "pk_test_FAKE" }, CLI);
    expect(r.ready).toBe(false);
    expect(r.secretKeyMode).toBe("unrecognized");
  });

  it("identical price IDs cannot pass (plan switching would be untestable)", () => {
    const r = evaluateReadiness({ ...COMPLETE, STRIPE_PRO_PRICE_ID: COMPLETE.STRIPE_BASIC_PRICE_ID }, CLI);
    expect(r.ready).toBe(false);
    expect(r.pricesDistinct).toBe(false);
    expect(r.problems.join(" ")).toMatch(/identical/i);
  });

  it("a mixed configuration (test key, production URL) is refused", () => {
    const r = evaluateReadiness({ ...COMPLETE, NEXT_PUBLIC_APP_URL: "https://app.mymatflow.com" }, CLI);
    expect(r.ready).toBe(false);
    expect(r.appUrl).toBe("production");
    expect(r.problems.join(" ")).toMatch(/production/i);
  });

  it("a preview URL is acceptable", () => {
    const r = evaluateReadiness({ ...COMPLETE, NEXT_PUBLIC_APP_URL: "https://matflow-x.vercel.app" }, CLI);
    expect(r.ready).toBe(true);
  });

  it("a missing Stripe CLI blocks readiness (webhooks cannot be forwarded)", () => {
    const r = evaluateReadiness(COMPLETE, { stripeCliPresent: false });
    expect(r.ready).toBe(false);
  });
});

describe("formatReport never leaks values", () => {
  it("prints classifications only", () => {
    const out = formatReport(evaluateReadiness(COMPLETE, CLI));
    for (const secret of Object.values(COMPLETE)) {
      if (secret.startsWith("http")) continue; // the URL kind is printed, not the URL
      expect(out).not.toContain(secret);
    }
    expect(out).toContain("Secret key mode");
    expect(out).toContain("test");
  });

  it("prints no fragment of a live key when refusing", () => {
    const out = formatReport(evaluateReadiness({ ...COMPLETE, STRIPE_SECRET_KEY: "sk_live_SUPERSECRET" }, CLI));
    expect(out).not.toContain("SUPERSECRET");
    expect(out).not.toContain("sk_live_");
    expect(out).toContain("live");
  });
});
