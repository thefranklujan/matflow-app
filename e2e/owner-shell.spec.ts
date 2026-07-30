import { test, expect, storageStatePath, expectCleanPage, expectNoHorizontalOverflow, watchPage } from "./helpers/test";

/**
 * Owner shell: every admin page renders real content (heading + no blank
 * body), with zero console/page errors, zero failed same-origin responses,
 * and no horizontal overflow. Runs on desktop AND the mobile project.
 */

// Pro-gated pages render an upgrade screen for the Basic owner — that is
// asserted separately in owner-entitlements; here we use the PRO owner so
// every page shows its real content.
const ADMIN_PAGES = [
  "", "requests", "members", "instructors", "schedule", "attendance",
  "notifications", "leads", "dropins", "announcements", "activity",
  "videos", "products", "orders", "inventory",
  "analytics", "waivers", "events", "competitions", "settings", "billing",
];

test.use({ storageState: storageStatePath("owner-pro") });

for (const slug of ADMIN_PAGES) {
  test(`/app/${slug || "(dashboard)"} renders cleanly`, async ({ page }) => {
    const health = watchPage(page);
    await page.goto(`/app/${slug}`);
    // Real content: at least one heading, non-empty main region.
    await expect(page.getByRole("heading").first()).toBeVisible();
    const textLength = await page.evaluate(() => document.body.innerText.trim().length);
    expect(textLength, "page is not blank").toBeGreaterThan(40);
    await expectNoHorizontalOverflow(page);
    expectCleanPage(health);
  });
}

test("legacy /admin routes redirect to /app equivalents", async ({ page }) => {
  await page.goto("/admin/members");
  await expect(page).toHaveURL(/\/app\/members/);
});

test("sidebar navigation exposes the grouped owner nav with no broken links", async ({ page }) => {
  const health = watchPage(page);
  await page.goto("/app");
  const isMobileViewport = (page.viewportSize()?.width ?? 1440) < 768;
  if (!isMobileViewport) {
    for (const group of ["Run", "Grow", "Commerce", "Manage"]) {
      await expect(page.getByText(group, { exact: true }).first()).toBeVisible();
    }
    // Walk a representative link from each group.
    for (const label of ["Members", "Announcements", "Products", "Analytics"]) {
      await page.getByRole("link", { name: label, exact: false }).first().click();
      await expect(page.getByRole("heading").first()).toBeVisible();
    }
  } else {
    // Mobile: bottom tabs + More menu.
    await expect(page.getByRole("link", { name: /schedule/i }).first()).toBeVisible();
    const more = page.getByRole("button", { name: /more/i }).first();
    await expect(more).toBeVisible();
    await more.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("link", { name: /settings/i }).first()).toBeVisible();
    await page.keyboard.press("Escape");
  }
  expectCleanPage(health);
});
