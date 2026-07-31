import { describe, it, expect } from "vitest";
import {
  APPROVED_SANDBOX_NAME,
  checkSandbox,
  fingerprintAccount,
  isPlausibleAccountId,
} from "./stripe-sandbox-guard";

const ACCOUNT = "acct_FAKESANDBOX123";
const OTHER = "acct_FAKEOTHER456";

describe("fingerprintAccount", () => {
  it("is deterministic", () => {
    expect(fingerprintAccount(ACCOUNT)).toBe(fingerprintAccount(ACCOUNT));
  });

  it("differs for different accounts", () => {
    expect(fingerprintAccount(ACCOUNT)).not.toBe(fingerprintAccount(OTHER));
  });

  it("ignores surrounding whitespace", () => {
    expect(fingerprintAccount(`  ${ACCOUNT}  `)).toBe(fingerprintAccount(ACCOUNT));
  });

  it("is one-way: the digest contains no part of the account id", () => {
    const fp = fingerprintAccount(ACCOUNT);
    expect(fp).not.toContain("acct_");
    expect(fp).not.toContain("FAKESANDBOX123");
    expect(fp).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe("checkSandbox fails closed", () => {
  const pinned = fingerprintAccount(ACCOUNT);

  it("approves only the pinned account", () => {
    const c = checkSandbox(ACCOUNT, pinned);
    expect(c.verdict).toBe("approved");
    expect(c.allowed).toBe(true);
  });

  it("refuses a different account", () => {
    const c = checkSandbox(OTHER, pinned);
    expect(c.verdict).toBe("mismatch");
    expect(c.allowed).toBe(false);
  });

  // The most important case: nobody has ever confirmed which account this is.
  it("refuses when nothing is pinned", () => {
    for (const p of [undefined, "", "   "]) {
      const c = checkSandbox(ACCOUNT, p);
      expect(c.verdict).toBe("unpinned");
      expect(c.allowed).toBe(false);
    }
  });

  it("refuses when the current account is unknown", () => {
    for (const a of [undefined, "", "   "]) {
      const c = checkSandbox(a, pinned);
      expect(c.verdict).toBe("unknown");
      expect(c.allowed).toBe(false);
    }
  });

  it("never allows anything when both sides are missing", () => {
    expect(checkSandbox(undefined, undefined).allowed).toBe(false);
  });

  it("messages name the approved sandbox but never an account id", () => {
    for (const c of [checkSandbox(OTHER, pinned), checkSandbox(ACCOUNT, undefined), checkSandbox(undefined, pinned)]) {
      expect(c.message).not.toContain("acct_");
      expect(c.message).not.toContain(pinned);
    }
    expect(checkSandbox(OTHER, pinned).message).toContain(APPROVED_SANDBOX_NAME);
  });
});

describe("isPlausibleAccountId", () => {
  it("accepts Stripe account id shape only", () => {
    expect(isPlausibleAccountId("acct_1A2b3C")).toBe(true);
    expect(isPlausibleAccountId("cus_1A2b3C")).toBe(false);
    expect(isPlausibleAccountId("acct_")).toBe(false);
    expect(isPlausibleAccountId(undefined)).toBe(false);
    expect(isPlausibleAccountId("")).toBe(false);
  });
});
