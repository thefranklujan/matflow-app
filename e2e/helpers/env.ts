import fs from "fs";
import path from "path";

/**
 * E2E environment resolution + safety gate.
 *
 * The E2E database URL comes from (in order):
 *   1. process.env.E2E_DATABASE_URL  (CI sets this explicitly)
 *   2. .env.e2e at the repo root     (local, never committed — .env* ignored)
 *
 * It must pass the same guard the unit-test suite uses (exact localhost
 * hostname + approved database name). There is NO fallback to DATABASE_URL,
 * .env, or any remote host: if the URL is missing or unsafe the whole run
 * refuses to start before any server boots or any row is written.
 */

export const E2E_PORT = 4310;

function readEnvE2e(): string | null {
  const p = path.join(__dirname, "..", "..", ".env.e2e");
  if (!fs.existsSync(p)) return null;
  const line = fs
    .readFileSync(p, "utf8")
    .split("\n")
    .find((l) => l.startsWith("E2E_DATABASE_URL="));
  return line ? line.slice("E2E_DATABASE_URL=".length).trim().replace(/^"|"$/g, "") : null;
}

/** Mirrors src/lib/test-db-safety.ts (kept dependency-free for playwright.config). */
export function assertSafeE2eDbUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("E2E database URL is not a valid URL.");
  }
  const safeHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
  if (!safeHosts.has(url.hostname)) {
    throw new Error(`E2E database host "${url.hostname}" is not localhost. Refusing to run E2E.`);
  }
  const dbName = url.pathname.replace(/^\//, "").split("?")[0];
  if (!["matflow_test", "matflow_e2e"].includes(dbName)) {
    throw new Error(`E2E database name "${dbName}" is not an approved test database. Refusing.`);
  }
  return raw;
}

const resolved = process.env.E2E_DATABASE_URL || readEnvE2e();
if (!resolved) {
  throw new Error(
    "No E2E database configured. Set E2E_DATABASE_URL or create .env.e2e with E2E_DATABASE_URL=postgresql://...localhost.../matflow_test",
  );
}
export const E2E_DATABASE_URL = assertSafeE2eDbUrl(resolved);

/**
 * The environment the Playwright-managed Next server runs with.
 * Synthetic secrets only; every external integration key is EMPTY so the
 * app's env-gated integrations (Stripe, Resend, OneSignal, Blob) stay inert.
 */
export const E2E_ENV: Record<string, string> = {
  ...process.env as Record<string, string>,
  DATABASE_URL: E2E_DATABASE_URL,
  DIRECT_URL: E2E_DATABASE_URL,
  JWT_SECRET: "e2e-only-jwt-secret-not-production-3f9c",
  PLATFORM_ADMIN_EMAILS: "founder@e2e.matflow.test",
  STRIPE_BASIC_PRICE_ID: "price_e2e_basic",
  STRIPE_PRO_PRICE_ID: "price_e2e_pro",
  // Explicitly blank: never talk to real services from E2E.
  STRIPE_SECRET_KEY: "",
  STRIPE_WEBHOOK_SECRET: "",
  RESEND_API_KEY: "",
  ONESIGNAL_API_KEY: "",
  NEXT_PUBLIC_ONESIGNAL_APP_ID: "",
  BLOB_READ_WRITE_TOKEN: "",
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: "",
  ALLOW_TEST_DB_MUTATION: "1",
  TZ: "America/Chicago",
};

/** Fixture identity constants — unmistakably synthetic. */
export const FIXTURE = {
  password: "E2e!Fixture-Passw0rd",
  emails: {
    ownerTrial: "owner.trial@e2e.matflow.test",
    ownerBasic: "owner.basic@e2e.matflow.test",
    ownerPro: "owner.pro@e2e.matflow.test",
    ownerLocked: "owner.locked@e2e.matflow.test",
    member: "member.basic@e2e.matflow.test",
    studentMember: "student.member@e2e.matflow.test",
    studentSolo: "student.solo@e2e.matflow.test",
    platform: "founder@e2e.matflow.test",
  },
  gyms: {
    trial: { slug: "e2e-trial-bjj", name: "E2E Trial BJJ" },
    basic: { slug: "e2e-basic-bjj", name: "E2E Basic BJJ" },
    pro: { slug: "e2e-pro-bjj", name: "E2E Pro BJJ" },
    locked: { slug: "e2e-locked-bjj", name: "E2E Locked BJJ" },
  },
  // Deterministic academy coordinates (downtown Houston) for proximity tests.
  coords: { lat: 29.7604, lng: -95.3698 },
} as const;

export const AUTH_DIR = path.join(__dirname, "..", ".auth");
export function storageStatePath(role: string): string {
  return path.join(AUTH_DIR, `${role}.json`);
}
