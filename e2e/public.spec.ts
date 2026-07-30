import { test, expect, storageStatePath } from "./helpers/test";
import { expectCleanPage, expectNoHorizontalOverflow } from "./helpers/test";
import { FIXTURE } from "./helpers/env";

test.describe("public surface", () => {
  test("landing renders the owner/student split with no errors", async ({ page, health }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /start free trial/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /create student account/i }).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
    expectCleanPage(health);
  });

  test("privacy and support pages exist and render headings", async ({ page, health }) => {
    await page.goto("/privacy");
    await expect(page.getByRole("heading").first()).toBeVisible();
    await page.goto("/support");
    await expect(page.getByRole("heading").first()).toBeVisible();
    expectCleanPage(health);
  });

  test("sign-in rejects invalid credentials with a visible message", async ({ page }) => {
    await page.goto("/sign-in");
    await page.locator('input[type="email"]').fill("nobody@e2e.matflow.test");
    await page.locator('input[type="password"]').fill("wrong-password");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.getByText(/invalid email or password/i)).toBeVisible();
    await expect(page).toHaveURL(/sign-in/);
  });

  test("sign-in succeeds for an owner and lands on /app", async ({ page }) => {
    await page.goto("/sign-in");
    await page.locator('input[type="email"]').fill(FIXTURE.emails.ownerBasic);
    await page.locator('input[type="password"]').fill(FIXTURE.password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/app$/);
  });

  test("protected owner route redirects anonymous visitors to sign-in", async ({ page }) => {
    await page.goto("/app/members");
    await expect(page).toHaveURL(/sign-in/);
  });

  test("protected student route redirects anonymous visitors to sign-in", async ({ page }) => {
    await page.goto("/student/schedule");
    await expect(page).toHaveURL(/sign-in/);
  });

  test("sign-out clears the session", async ({ browser }) => {
    const context = await browser.newContext({ storageState: storageStatePath("owner-basic") });
    const page = await context.newPage();
    await page.goto("/app");
    await expect(page).toHaveURL(/\/app$/);
    // Sign out via the API the UI uses, then confirm protection is restored.
    await page.request.post("/api/auth/logout");
    await page.goto("/app/members");
    await expect(page).toHaveURL(/sign-in/);
    await context.close();
  });
});
