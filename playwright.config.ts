import { defineConfig, devices } from "@playwright/test";
import { E2E_ENV, E2E_PORT } from "./e2e/helpers/env";

/**
 * MatFlow E2E configuration.
 *
 * - Boots its OWN Next dev server on a dedicated port with a fully
 *   controlled environment: the isolated local E2E database, a synthetic
 *   JWT secret, synthetic Stripe price ids, and NO external service keys.
 * - There is deliberately no production URL fallback: baseURL is always
 *   localhost. Tests can never point at a deployed environment.
 * - Deterministic timezone/locale so calendar and time assertions are stable.
 */
export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results",
  // One worker: the specs share a single seeded database, and the journey
  // specs mutate it (check-ins, class creation). Serial execution keeps every
  // assertion deterministic; the whole suite still runs in single-digit minutes.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  forbidOnly: !!process.env.CI,
  timeout: 45_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
      maxDiffPixelRatio: 0.02,
    },
  },
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${E2E_PORT}`,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "on-first-retry",
    timezoneId: "America/Chicago",
    locale: "en-US",
    colorScheme: "dark",
  },
  webServer: {
    // Production server: deterministic, no dev overlay/on-demand compilation.
    command: `npx next build && npx next start -p ${E2E_PORT}`,
    url: `http://localhost:${E2E_PORT}`,
    reuseExistingServer: false, // orphaned servers serve stale builds (400s on hashed chunks)
    timeout: 300_000,
    env: E2E_ENV,
  },
  projects: [
    { name: "setup", testMatch: /global\.setup\.ts/ },
    {
      // A visual failure must never block the functional suite: desktop and
      // mobile depend only on "setup", not on "visual". The visual spec
      // reseeds fixtures in its own beforeAll, so it is order-independent.
      name: "visual",
      testMatch: /visual\.spec\.ts/,
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "desktop",
      testMatch: /.*\.spec\.ts/,
      testIgnore: /visual/,
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "mobile",
      testMatch: /(student-core|owner-shell)\.spec\.ts/,
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        isMobile: false, // keep mouse events; layout is what we're testing
      },
    },
  ],
});
