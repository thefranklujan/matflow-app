import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { validateTestDbUrl } from "./test-db-safety";

let savedFlag: string | undefined;
beforeEach(() => {
  savedFlag = process.env.ALLOW_TEST_DB_MUTATION;
  process.env.ALLOW_TEST_DB_MUTATION = "1";
});
afterEach(() => {
  if (savedFlag === undefined) delete process.env.ALLOW_TEST_DB_MUTATION;
  else process.env.ALLOW_TEST_DB_MUTATION = savedFlag;
});

describe("validateTestDbUrl — URL parsing, not regex", () => {
  it("approves the local throwaway databases on exact local hostnames", () => {
    for (const url of [
      "postgresql://u:p@localhost:5544/matflow_dev?schema=public",
      "postgres://u:p@127.0.0.1:5544/matflow_test",
      "postgresql://u:p@[::1]:5544/matflow_dev",
    ]) {
      const r = validateTestDbUrl(url);
      expect(r.ok, url).toBe(true);
      if (r.ok) {
        expect(r.db.sanitized).not.toContain("u:p"); // never leaks credentials
      }
    }
  });

  it("rejects regex-fooling hostnames that merely CONTAIN localhost", () => {
    for (const url of [
      "postgresql://u:p@localhost.evil.com:5432/matflow_dev", // old regex passed this
      "postgresql://u:p@127.0.0.1.evil.com:5432/matflow_dev",
      "postgresql://u:p@notlocalhost:5432/matflow_dev",
    ]) {
      const r = validateTestDbUrl(url);
      expect(r.ok, url).toBe(false);
    }
  });

  it("rejects production-looking hosts and unapproved database names", () => {
    expect(validateTestDbUrl("postgresql://u:p@db.ocqcgrjogmfppphbyqec.supabase.co:5432/postgres").ok).toBe(false);
    expect(validateTestDbUrl("postgresql://u:p@localhost:5544/postgres").ok).toBe(false);
    expect(validateTestDbUrl("postgresql://u:p@localhost:5544/matflow_prod").ok).toBe(false);
  });

  it("rejects non-postgres protocols, garbage, and empty input", () => {
    expect(validateTestDbUrl("mysql://u:p@localhost/matflow_dev").ok).toBe(false);
    expect(validateTestDbUrl("not a url at all").ok).toBe(false);
    expect(validateTestDbUrl(null).ok).toBe(false);
  });

  it("requires the explicit ALLOW_TEST_DB_MUTATION=1 opt-in", () => {
    delete process.env.ALLOW_TEST_DB_MUTATION;
    const r = validateTestDbUrl("postgresql://u:p@localhost:5544/matflow_dev");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("ALLOW_TEST_DB_MUTATION");
  });
});
