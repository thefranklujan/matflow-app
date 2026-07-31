import { test as base, expect, type Page, type BrowserContext } from "@playwright/test";
import { storageStatePath } from "./env";

/**
 * Shared E2E test wrapper:
 * - Blocks EVERY non-localhost network request (no external service can be
 *   reached even accidentally).
 * - Collects console errors, page errors, and failed same-origin responses;
 *   `expectCleanPage()` asserts the page stayed clean.
 */

export interface PageHealth {
  consoleErrors: string[];
  pageErrors: string[];
  badResponses: string[];
}

export function watchPage(page: Page): PageHealth {
  const health: PageHealth = { consoleErrors: [], pageErrors: [], badResponses: [] };
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (/Download the React DevTools/i.test(text)) return;
    // Expected auth-flow noise: intentional 401 probes from auth-context.
    if (/Failed to load resource.*40[13]/.test(text)) return;
    health.consoleErrors.push(text);
  });
  page.on("pageerror", (err) => health.pageErrors.push(String(err)));
  page.on("response", (res) => {
    const url = res.url();
    if (!url.includes("localhost")) return;
    // 401/402/403/404 can be legitimate (auth probes, entitlement gates,
    // intentionally-missing optional resources are NOT — treat 404 and 5xx as bad).
    if (res.status() >= 500 || res.status() === 404) {
      health.badResponses.push(`${res.status()} ${url}`);
    }
  });
  return health;
}

export function expectCleanPage(health: PageHealth, opts: { allow404?: RegExp[] } = {}) {
  const bad = health.badResponses.filter((r) => !(opts.allow404 || []).some((re) => re.test(r)));
  expect(health.pageErrors, "no uncaught page errors").toEqual([]);
  expect(health.consoleErrors, "no console errors").toEqual([]);
  expect(bad, "no failed same-origin responses").toEqual([]);
}

/**
 * Real in-page alerts, excluding Next.js's always-present (and empty) route
 * announcer, which also carries role="alert".
 */
export function alertRegion(page: Page) {
  return page.locator('[role="alert"]:not(#__next-route-announcer__)');
}

export async function blockExternal(context: BrowserContext) {
  await context.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, (route) => route.abort());
}

export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth - doc.clientWidth;
  });
  expect(overflow, "no horizontal overflow (scrollWidth <= clientWidth)").toBeLessThanOrEqual(1);
}

/** Wait for fonts + network idle-ish settling before visual capture. */
export async function settle(page: Page) {
  await page.evaluate(() => (document as unknown as { fonts: { ready: Promise<unknown> } }).fonts.ready);
  await page.waitForLoadState("networkidle");
}

export const test = base.extend<{ health: PageHealth }>({
  context: async ({ context }, use) => {
    await blockExternal(context);
    await use(context);
  },
  health: async ({ page }, use) => {
    const health = watchPage(page);
    await use(health);
  },
});

export { expect, storageStatePath };
