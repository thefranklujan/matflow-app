import { test, expect, storageStatePath, watchPage, expectCleanPage } from "./helpers/test";

/** Platform/founder surface + hard access control. */

test.describe("platform founder", () => {
  test.use({ storageState: storageStatePath("platform") });

  const PAGES = ["", "gyms", "students", "activity", "approve-gyms", "nominations", "database"];
  for (const slug of PAGES) {
    test(`/platform/${slug || "(dashboard)"} renders cleanly`, async ({ page }) => {
      const health = watchPage(page);
      await page.goto(`/platform/${slug}`);
      await expect(page.locator("h1, h2").first()).toBeVisible();
      expectCleanPage(health);
    });
  }

  test("academy list shows fixture academies and opens academy detail", async ({ page }) => {
    const fs = await import("fs");
    const path = await import("path");
    const ids = JSON.parse(fs.readFileSync(path.join(__dirname, ".auth", "fixture-ids.json"), "utf8"));
    await page.goto("/platform/gyms");
    await expect(page.getByText("E2E Basic BJJ").first()).toBeVisible();
    await page.goto(`/platform/gyms/${ids.gyms.basic}`);
    await expect(page.getByText(/E2E Basic BJJ/i).first()).toBeVisible();
    await expect(page.getByRole("heading").first()).toBeVisible();
  });

  test("platform metrics render without fabricated values", async ({ page }) => {
    await page.goto("/platform");
    const body = await page.evaluate(() => document.body.innerText);
    expect(body).not.toMatch(/NaN|undefined|Infinity/);
  });
});

test.describe("platform access control", () => {
  test("ordinary owner cannot open platform routes", async ({ browser }) => {
    const context = await browser.newContext({ storageState: storageStatePath("owner-basic") });
    const page = await context.newPage();
    await page.goto("/platform");
    // Redirected away or denied — never the platform dashboard.
    const onPlatform = /\/platform/.test(page.url());
    if (onPlatform) {
      const body = (await page.evaluate(() => document.body.innerText)).toLowerCase();
      expect(body).toMatch(/not authorized|denied|access|sign in/);
    }
    // Platform APIs must reject too.
    const res = await page.request.get("/api/platform/metrics");
    expect([401, 403, 404]).toContain(res.status());
    await context.close();
  });

  test("student cannot open platform routes", async ({ browser }) => {
    const context = await browser.newContext({ storageState: storageStatePath("student-member") });
    const page = await context.newPage();
    await page.goto("/platform/gyms");
    const body = (await page.evaluate(() => document.body.innerText)).toLowerCase();
    const leaked = body.includes("e2e locked bjj") && /\/platform/.test(page.url());
    expect(leaked, "platform academy roster must not render for students").toBe(false);
    await context.close();
  });
});
