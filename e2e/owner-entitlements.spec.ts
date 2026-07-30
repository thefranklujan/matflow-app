import { test, expect, storageStatePath } from "./helpers/test";

/**
 * Entitlement boundaries, enforced SERVER-side (direct URL + direct API — a
 * client can never route around them).
 */

const PRO_ONLY_PAGES = ["leads", "dropins", "events", "competitions"];

test.describe("trial owner (Basic boundary during trial)", () => {
  test.use({ storageState: storageStatePath("owner-trial") });

  test("dashboard and core Run pages are accessible", async ({ page }) => {
    await page.goto("/app");
    await expect(page).toHaveURL(/\/app$/);
    await page.goto("/app/members");
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });

  test("Pro-only pages show the upgrade screen, not the feature", async ({ page }) => {
    for (const slug of PRO_ONLY_PAGES) {
      await page.goto(`/app/${slug}`);
      await expect(page.getByText(/upgrade to pro/i).first()).toBeVisible();
    }
  });
});

test.describe("Basic owner", () => {
  test.use({ storageState: storageStatePath("owner-basic") });

  test("Pro-only pages remain gated for Basic", async ({ page }) => {
    for (const slug of PRO_ONLY_PAGES) {
      await page.goto(`/app/${slug}`);
      await expect(page.getByText(/upgrade to pro/i).first()).toBeVisible();
    }
  });

  test("Pro-only APIs reject direct requests", async ({ page }) => {
    for (const api of ["/api/admin/leads", "/api/admin/dropins"]) {
      const res = await page.request.get(api);
      expect([401, 402, 403, 404]).toContain(res.status()); // 404 = list endpoint absent/hidden; never data
    }
  });

  test("analytics renders Basic metrics without fake claims", async ({ page }) => {
    await page.goto("/app/analytics");
    await expect(page.getByRole("heading", { name: "Analytics", exact: true })).toBeVisible();
    const body = await page.evaluate(() => document.body.innerText);
    expect(body).not.toMatch(/undefined|NaN|Infinity/);
  });

  test("billing page shows the current plan state", async ({ page }) => {
    await page.goto("/app/billing");
    await expect(page.locator("h1, h2").first()).toBeVisible();
    await expect(page.getByText(/basic/i).first()).toBeVisible();
  });
});

test.describe("Pro owner", () => {
  test.use({ storageState: storageStatePath("owner-pro") });

  test("Pro pages render the real feature, not an upgrade screen", async ({ page }) => {
    for (const slug of PRO_ONLY_PAGES) {
      await page.goto(`/app/${slug}`);
      await expect(page.getByText(/upgrade to pro \(\$99/i)).toHaveCount(0);
      await expect(page.locator("h1, h2").first()).toBeVisible();
    }
  });
});

test.describe("locked (past_due) owner", () => {
  test.use({ storageState: storageStatePath("owner-locked") });

  test("owner APIs are blocked outside the recovery allowlist", async ({ page }) => {
    const res = await page.request.get("/api/admin/members");
    expect([401, 402, 403, 404]).toContain(res.status());
  });

  test("billing remains reachable for recovery", async ({ page }) => {
    await page.goto("/app/billing");
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });

  test("a locked owner sees a lock/recovery state, not normal features", async ({ page }) => {
    await page.goto("/app/members");
    const body = (await page.evaluate(() => document.body.innerText)).toLowerCase();
    expect(body).toMatch(/past due|payment|billing|locked|update.*card|restore/);
  });
});

test.describe("non-admin member cannot use admin surfaces", () => {
  test.use({ storageState: storageStatePath("member") });

  test("admin APIs reject the member role", async ({ page }) => {
    for (const api of ["/api/admin/members", "/api/admin/leads"]) {
      const res = await page.request.get(api);
      expect([401, 402, 403, 404]).toContain(res.status());
    }
  });

  test("admin settings page does not render admin controls for members", async ({ page }) => {
    await page.goto("/app/settings");
    const body = (await page.evaluate(() => document.body.innerText)).toLowerCase();
    // Either redirected away or shown a denial — never the gym settings form.
    const deniedOrRedirected = !/danger zone|stripe|subscription status/.test(body);
    expect(deniedOrRedirected).toBe(true);
  });
});
