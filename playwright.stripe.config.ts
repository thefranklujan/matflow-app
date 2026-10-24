import { defineConfig, devices } from "@playwright/test";
import { assertSafeE2eDbUrl } from "./e2e/helpers/env";

/**
 * Stripe SANDBOX lifecycle run (the 20 stages in
 * src/lib/stripe-lifecycle-stages.json). Never part of the normal suites.
 *
 * Start it only through scripts/stripe-lifecycle-run.mjs, which refuses live
 * keys, requires the pinned "MatFlow Billing QA" sandbox, obtains the
 * `stripe listen` signing secret, forwards webhooks to this server, and passes
 * every value through the environment (nothing is read from .env files here).
 *
 * Unlike the E2E suite, external requests are allowed: hosted Checkout and the
 * Customer Portal live on stripe.com.
 */
const PORT = Number(process.env.STRIPE_LIFECYCLE_PORT || 4311);
const key = process.env.STRIPE_SECRET_KEY || "";
if (!/^(sk|rk)_test_/.test(key)) {
  throw new Error("Stripe lifecycle: a sandbox test-mode key is required (run via scripts/stripe-lifecycle-run.mjs).");
}
if (!process.env.STRIPE_WEBHOOK_SECRET) throw new Error("Stripe lifecycle: STRIPE_WEBHOOK_SECRET missing.");
const dbUrl = assertSafeE2eDbUrl(process.env.E2E_DATABASE_URL || "");

export default defineConfig({
  testDir: "./e2e-stripe",
  outputDir: "./test-results-stripe",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 180_000,
  expect: { timeout: 30_000 },
  reporter: [["list"]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    timezoneId: "America/Chicago",
    locale: "en-US",
  },
  webServer: {
    command: `npx next build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 300_000,
    env: {
      ...(process.env as Record<string, string>),
      DATABASE_URL: dbUrl,
      DIRECT_URL: dbUrl,
      JWT_SECRET: "stripe-sandbox-only-jwt-secret-5d21",
      NEXT_PUBLIC_APP_URL: `http://localhost:${PORT}`,
      RESEND_API_KEY: "",
      ONESIGNAL_API_KEY: "",
      NEXT_PUBLIC_ONESIGNAL_APP_ID: "",
      BLOB_READ_WRITE_TOKEN: "",
      TZ: "America/Chicago",
    },
  },
});
