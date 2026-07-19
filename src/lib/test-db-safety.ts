import { readFileSync } from "fs";
import { join } from "path";

/**
 * Central safety gate for every test that MUTATES a database (Vitest
 * integration suites and Playwright fixtures).
 *
 * A database URL is approved for test mutation ONLY when all of these hold:
 * 1. It parses as a URL (never regex-matched) with a postgres protocol.
 * 2. Its hostname is EXACTLY localhost, 127.0.0.1, or ::1.
 * 3. Its database name is on the explicit approved list.
 * 4. ALLOW_TEST_DB_MUTATION=1 is set (the repo's test scripts set it; ad-hoc
 *    runners must opt in consciously).
 *
 * Never returns or logs credentials: the sanitized description contains only
 * host, port, and database name.
 */

export const APPROVED_TEST_DB_NAMES = ["matflow_dev", "matflow_test"];
const SAFE_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export interface SafeTestDb {
  url: string;
  /** host:port/dbname only — safe to print. */
  sanitized: string;
}

export type SafeTestDbResult =
  | { ok: true; db: SafeTestDb }
  | { ok: false; reason: string };

export function validateTestDbUrl(rawUrl: string | null | undefined): SafeTestDbResult {
  if (!rawUrl) return { ok: false, reason: "no DATABASE_URL configured" };

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, reason: "DATABASE_URL is not a parseable URL" };
  }

  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    return { ok: false, reason: `unsupported protocol ${parsed.protocol}` };
  }
  if (!SAFE_HOSTNAMES.has(parsed.hostname)) {
    return { ok: false, reason: `hostname ${parsed.hostname} is not a local address` };
  }
  const dbName = parsed.pathname.replace(/^\//, "").split("/")[0];
  if (!APPROVED_TEST_DB_NAMES.includes(dbName)) {
    return { ok: false, reason: `database "${dbName}" is not on the approved test list` };
  }
  if (process.env.ALLOW_TEST_DB_MUTATION !== "1") {
    return { ok: false, reason: "ALLOW_TEST_DB_MUTATION=1 is not set" };
  }
  return {
    ok: true,
    db: { url: rawUrl, sanitized: `${parsed.hostname}:${parsed.port || "5432"}/${dbName}` },
  };
}

/**
 * The integration suites' entry point. Sources, in order:
 * 1. TEST_DATABASE_URL from the environment (explicit test override — CI).
 * 2. DATABASE_URL from the app's .env.local FILE (the local dev rig).
 *
 * Ambient process.env.DATABASE_URL is DELIBERATELY ignored: Prisma's dotenv
 * loads the app's .env (which can hold the PRODUCTION url) into process.env
 * at import time — trusting it here nearly pointed mutating tests at prod
 * (caught by this gate on 2026-07-19).
 *
 * Returns null when nothing is configured (suite reports itself skipped);
 * THROWS when a URL is configured but fails validation, so a misconfigured
 * suite can never silently soft-pass.
 */
export function safeTestDbFromEnvFile(appRoot: string): SafeTestDb | null {
  let raw: string | null = process.env.TEST_DATABASE_URL ?? null;
  if (!raw) {
    try {
      const env = readFileSync(join(appRoot, ".env.local"), "utf8");
      const m = env.match(/^DATABASE_URL=("?)(.+?)\1$/m);
      raw = m?.[2] ?? null;
    } catch {
      raw = null;
    }
  }
  if (!raw) return null;

  const result = validateTestDbUrl(raw);
  if (!result.ok) {
    throw new Error(
      `test-db-safety: refusing to run mutating tests — ${result.reason}. ` +
      "Tests only ever run against the approved local throwaway database.",
    );
  }
  return result.db;
}
