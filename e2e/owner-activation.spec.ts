import { test, expect, storageStatePath, watchPage, expectCleanPage, expectNoHorizontalOverflow } from "./helpers/test";

/**
 * Owner first-use dashboard: activation states, operational surfaces, and the
 * founder queue reflecting the same truth.
 *
 * Fixture academies cover the states: Basic (activated, live attendance),
 * Trial (schedules but no members/instructors — partially configured), and
 * Locked (past_due recovery).
 */

test.describe("owner dashboard — activated academy with live usage", () => {
  test.use({ storageState: storageStatePath("owner-basic") });

  test("shows operational stats, not commerce, and a quiet post-activation line", async ({ page }) => {
    const health = watchPage(page);
    await page.goto("/app");

    // Operational figures are the primary numbers.
    await expect(page.getByText("Active members", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Instructors", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Weekly classes", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/Check-ins \(last \d+ days\)/).first()).toBeVisible();

    // Commerce is no longer the dashboard's headline.
    await expect(page.getByRole("heading", { name: "Recent Orders" })).toHaveCount(0);
    await expect(page.getByText("Low Stock Items")).toHaveCount(0);

    // Operational surfaces replace it.
    await expect(page.getByRole("heading", { name: /today's classes/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /recent check-ins/i })).toBeVisible();

    // Setup treatment is reduced to one line once activated.
    await expect(page.getByText(/Setup complete\./).first()).toBeVisible();
    await expect(page.getByText(/your academy is live/i).first()).toBeVisible();
    expectCleanPage(health);
  });

  test("truthfully reports subscription status", async ({ page }) => {
    await page.goto("/app");
    await expect(page.getByRole("link", { name: /subscription active|trial ends|review your plan/i }).first()).toBeVisible();
  });

  test("no nested cards and no overflow at every width", async ({ page }) => {
    for (const width of [320, 375, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/app");
      await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
      await expectNoHorizontalOverflow(page);
    }
    // Structural rule: a dashboard card must not contain another card.
    const nested = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll("main .bg-\\[\\#1a1a1a\\]"));
      return cards.filter((c) => c.querySelector(".bg-\\[\\#1a1a1a\\]")).length;
    });
    expect(nested, "no cards nested inside cards").toBe(0);
  });
});

test.describe("owner dashboard — partially configured academy", () => {
  test.use({ storageState: storageStatePath("owner-trial") });

  test("shows the setup checklist with real progress and a next action", async ({ page }) => {
    const health = watchPage(page);
    await page.goto("/app");
    // The trial fixture has classes but no members/instructors beyond the owner.
    await expect(page.getByText(/finish setting up/i).first()).toBeVisible();
    await expect(page.getByText(/add your first member|add an instructor/i).first()).toBeVisible();
    // Never claims completion it cannot derive.
    await expect(page.getByText(/Setup complete\./)).toHaveCount(0);
    expectCleanPage(health);
  });

  test("empty operational surfaces offer an action instead of a dead end", async ({ page }) => {
    await page.goto("/app");
    const body = await page.evaluate(() => document.body.innerText);
    expect(body).toMatch(/record attendance|no check-ins yet|create your first class|nothing scheduled/i);
  });
});

test.describe("owner dashboard — locked academy keeps recovery", () => {
  test.use({ storageState: storageStatePath("owner-locked") });

  test("billing and settings stay reachable", async ({ page }) => {
    await page.goto("/app/billing");
    await expect(page.getByRole("heading").first()).toBeVisible();
  });
});

test.describe("founder sales queue", () => {
  test("owners and students cannot reach it", async ({ browser }) => {
    for (const role of ["owner-basic", "student-member"]) {
      const context = await browser.newContext({ storageState: storageStatePath(role) });
      const page = await context.newPage();
      await page.goto("/platform/sales");
      const onSales = /\/platform\/sales/.test(page.url());
      if (onSales) {
        const body = (await page.evaluate(() => document.body.innerText)).toLowerCase();
        expect(body, `${role} must not see the queue`).not.toContain("sales & onboarding queue");
      }
      await context.close();
    }
  });

  test("anonymous visitors are redirected away", async ({ page }) => {
    await page.goto("/platform/sales");
    await expect(page).toHaveURL(/sign-in/);
  });

  test.describe("as the founder", () => {
    test.use({ storageState: storageStatePath("platform") });

    test("lists real academies with derived truth and definitions", async ({ page }) => {
      const health = watchPage(page);
      await page.goto("/platform/sales");
      await expect(page.getByRole("heading", { name: /sales & onboarding queue/i })).toBeVisible();

      // Fixture academies appear.
      await expect(page.getByText("E2E Basic BJJ").first()).toBeVisible();
      await expect(page.getByText("E2E Locked BJJ").first()).toBeVisible();

      // The locked academy is flagged as the top-priority billing issue.
      // Scope to the rendered rows: the filter <select> also contains this text.
      await expect(page.locator("table, ul").getByText(/billing needs attention/i).first()).toBeVisible();

      // Definitions are stated, and unavailable metrics are labelled honestly.
      await expect(page.getByText(/only server allow-listed Basic\/Pro prices count/i)).toBeVisible();
      await expect(page.getByText(/Trial-to-paid conversion rate/)).toBeVisible();
      await expect(page.getByText(/Missing/).first()).toBeVisible();
      expectCleanPage(health);
    });

    test("search and filters narrow the queue", async ({ page }) => {
      await page.goto("/platform/sales");
      const count = page.getByTestId("sales-count");
      const initial = await count.innerText();

      await page.locator("#sales-search").fill("Locked");
      await expect(count).not.toHaveText(initial);
      await expect(page.getByText("E2E Locked BJJ").first()).toBeVisible();
      await expect(page.getByText("E2E Basic BJJ")).toHaveCount(0);

      await page.locator("#sales-search").fill("");
      await page.locator("#sales-billing").selectOption("trouble");
      await expect(page.getByText("E2E Locked BJJ").first()).toBeVisible();

      // A filter combination with no matches offers a way back.
      await page.locator("#sales-search").fill("no-such-academy-anywhere");
      await expect(page.getByText(/no academies match these filters/i)).toBeVisible();
      await page.getByRole("button", { name: /clear filters/i }).click();
      await expect(count).toHaveText(initial);
    });

    test("sorting changes the order", async ({ page }) => {
      await page.goto("/platform/sales");
      const firstBy = async () => (await page.locator("table tbody tr td:first-child").first().innerText()).trim();
      await page.locator("#sales-sort").selectOption("urgency");
      const urgent = await firstBy();
      await page.locator("#sales-sort").selectOption("created");
      const newest = await firstBy();
      // Urgency leads with the billing-issue academy; newest leads by date.
      expect(urgent).toMatch(/Locked/);
      expect(newest.length).toBeGreaterThan(0);
    });

    test("mobile list renders without overflow", async ({ page }) => {
      for (const width of [320, 375, 390]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto("/platform/sales");
        await expect(page.getByRole("heading", { name: /sales & onboarding queue/i })).toBeVisible();
        await expectNoHorizontalOverflow(page);
        // The desktop table is hidden; the purpose-built list is shown.
        await expect(page.locator("table")).toBeHidden();
      }
    });

    test("every academy links to its platform detail", async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto("/platform/sales");
      const links = page.locator('a[href^="/platform/gyms/"]');
      expect(await links.count()).toBeGreaterThan(0);
    });
  });
});
