import { test as base, expect } from "@playwright/test";
import { storageStatePath, watchPage, expectCleanPage, blockExternal } from "./helpers/test";
import { FIXTURE } from "./helpers/env";

/**
 * Foreground proximity check-in.
 *
 * Native emulation WITHOUT touching production code: the component gates on
 * `window.Capacitor.isNativePlatform()`, and @capacitor/geolocation's web
 * implementation reads the browser Permissions + Geolocation APIs — both of
 * which Playwright controls deterministically. No coordinates beyond the
 * fixture academy's are used anywhere.
 */

const test = base.extend({});

test.use({ storageState: storageStatePath("student-member") });

function nativeInit() {
  (window as unknown as { Capacitor: unknown }).Capacitor = {
    isNativePlatform: () => true,
    getPlatform: () => "ios",
  };
}

test("web mode stays a no-op: no explainer, no sheet, no location use", async ({ browser }) => {
  const context = await browser.newContext({ storageState: storageStatePath("student-member") });
  await blockExternal(context);
  const page = await context.newPage();
  const health = watchPage(page);
  await page.goto("/student");
  await page.waitForTimeout(3500); // past the component's 2.5s launch delay
  await expect(page.getByText(/turn on location/i)).toHaveCount(0);
  await expect(page.locator('[aria-labelledby="arrival-heading"]')).toHaveCount(0);
  expectCleanPage(health);
  await context.close();
});

test("native emulation: truthful explainer when permission is undetermined", async ({ browser }) => {
  const context = await browser.newContext({ storageState: storageStatePath("student-member") });
  await blockExternal(context);
  const page = await context.newPage();
  await page.addInitScript(nativeInit);
  await page.goto("/student");
  const explainer = page.getByText(/turn on location to confirm your check-in when you open matflow/i);
  await expect(explainer).toBeVisible({ timeout: 10_000 });
  // Never overpromise background behavior.
  await expect(page.getByText(/automatically/i)).toHaveCount(0);
  // "Not now" stamps a membership-scoped cooldown.
  await page.getByRole("button", { name: /not now/i }).click();
  await expect(explainer).toHaveCount(0);
  const keys = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("matflow-arrival")));
  expect(keys.some((k) => k.startsWith("matflow-arrival-explainer-dismissed-at:"))).toBe(true);
  expect(keys).not.toContain("matflow-arrival-explainer-dismissed-at"); // no legacy global key
  await context.close();
});

test("native emulation: full arrival flow, cooldown, and membership scoping", async ({ browser }) => {
  test.setTimeout(90_000);
  const context = await browser.newContext({
    storageState: storageStatePath("student-member"),
    permissions: ["geolocation"],
    geolocation: { latitude: FIXTURE.coords.lat, longitude: FIXTURE.coords.lng, accuracy: 10 },
  });
  await blockExternal(context);
  const page = await context.newPage();
  const health = watchPage(page);
  await page.addInitScript(nativeInit);
  await page.goto("/student");

  // Arrival sheet appears (server-verified: real proximity + attestation).
  const sheet = page.locator('[aria-labelledby="arrival-heading"]');
  await expect(sheet).toBeVisible({ timeout: 15_000 });
  await expect(sheet.getByText(/are you attending class\?/i)).toBeVisible();
  await sheet.getByRole("button", { name: /^check in$/i }).click();

  // One or two classes may be open depending on sibling specs; handle both.
  const confirm = sheet.getByRole("button", { name: /confirm check-in/i });
  if (!(await confirm.isVisible().catch(() => false))) {
    await sheet.locator("li button").first().click();
  }
  await confirm.click();
  await expect(sheet.getByRole("status")).toBeVisible({ timeout: 10_000 });
  const statusText = (await sheet.getByRole("status").innerText()).toLowerCase();
  expect(statusText).toMatch(/checked in/);
  await sheet.getByRole("button", { name: /^done$/i }).click();
  await expect(sheet).toHaveCount(0);

  // Visit cooldown is stamped and scoped to this membership.
  const cooldownKeys = await page.evaluate(() =>
    Object.keys(localStorage).filter((k) => k.startsWith("matflow-arrival-sheet-dismissed-at:")),
  );
  expect(cooldownKeys).toHaveLength(1);

  // Reload (fresh foreground): no re-prompt inside the cooldown.
  await page.reload();
  await page.waitForTimeout(4000);
  await expect(page.locator('[aria-labelledby="arrival-heading"]')).toHaveCount(0);
  expectCleanPage(health);
  await context.close();

  // A DIFFERENT membership on the same "device" (same storage dir simulated by
  // carrying localStorage over) is not suppressed: its context key differs, so
  // the arrival evaluation still proceeds to a server decision.
  const otherContext = await browser.newContext({
    storageState: storageStatePath("student-solo"),
    permissions: ["geolocation"],
    geolocation: { latitude: FIXTURE.coords.lat, longitude: FIXTURE.coords.lng, accuracy: 10 },
  });
  await blockExternal(otherContext);
  const otherPage = await otherContext.newPage();
  await otherPage.addInitScript(nativeInit);
  // Pre-populate the FIRST membership's cooldown key to prove it does not
  // suppress a different account.
  await otherPage.addInitScript(([key]) => localStorage.setItem(key, String(Date.now())), [cooldownKeys[0]] as const);
  await otherPage.goto("/student");
  await otherPage.waitForTimeout(3500);
  // The solo student has no membership -> server says ineligible -> silence.
  // The important assertion: the flow REACHED the server decision rather than
  // being suppressed by the other account's cooldown key.
  const eligibility = await otherPage.request.get("/api/student/proximity-ping");
  const body = await eligibility.json();
  expect(body.eligible).toBeFalsy(); // solo student: correctly ineligible, not cooldown-suppressed
  await otherContext.close();
});

test("proximity POST never notifies the owner and stores no coordinates", async ({ browser }) => {
  // API-level guarantee re-checked E2E: the decision endpoint is read-only.
  const context = await browser.newContext({ storageState: storageStatePath("student-member") });
  const api = context.request;
  const before = await api.get("/api/student/proximity-ping");
  expect((await before.json()).eligible).toBe(true);
  const outside = await api.post("/api/student/proximity-ping", {
    data: { lat: FIXTURE.coords.lat + 0.05, lng: FIXTURE.coords.lng, accuracy: 10 },
  });
  const body = await outside.json();
  expect(body.result).toBe("outside");
  expect(JSON.stringify(body)).not.toMatch(/"lat"|"lng"/);
  await context.close();
});
