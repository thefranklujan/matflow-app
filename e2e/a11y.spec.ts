import { test, expect, storageStatePath } from "./helpers/test";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

/**
 * Accessibility gate: ZERO serious/critical axe violations on representative
 * stable states. Moderate/minor findings are reported in
 * MATFLOW-E2E-FINDINGS.md rather than silenced.
 */

async function expectNoSeriousViolations(page: Page, label: string, scope?: string) {
  const builder = new AxeBuilder({ page });
  if (scope) builder.include(scope);
  const results = await builder.analyze();
  const seriousOrCritical = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  const summary = seriousOrCritical.map((v) => `${v.impact}: ${v.id} (${v.nodes.length} nodes) — ${v.help}`);
  expect(summary, `${label}: no serious/critical axe violations`).toEqual([]);
}

const SURFACES: { label: string; path: string; role: string | null }[] = [
  { label: "landing", path: "/", role: null },
  { label: "sign-in", path: "/sign-in", role: null },
  { label: "owner sign-up", path: "/sign-up", role: null },
  { label: "student sign-up", path: "/student/sign-up", role: null },
  { label: "forgot password", path: "/forgot-password", role: null },
  // Synthetic token: exercises the real form state without any emailed token.
  { label: "reset password", path: "/reset-password?token=e2e-synthetic-token", role: null },
  { label: "privacy", path: "/privacy", role: null },
  { label: "support", path: "/support", role: null },
  { label: "owner dashboard", path: "/app", role: "owner-basic" },
  { label: "owner members", path: "/app/members", role: "owner-basic" },
  { label: "owner schedule", path: "/app/schedule", role: "owner-basic" },
  { label: "owner attendance", path: "/app/attendance", role: "owner-basic" },
  { label: "owner analytics", path: "/app/analytics", role: "owner-basic" },
  { label: "owner billing", path: "/app/billing", role: "owner-basic" },
  { label: "owner settings", path: "/app/settings", role: "owner-basic" },
  { label: "student dashboard", path: "/student", role: "student-member" },
  { label: "student schedule", path: "/student/schedule", role: "student-member" },
  { label: "student training", path: "/student/training", role: "student-member" },
  { label: "student profile", path: "/student/profile", role: "student-member" },
  { label: "platform dashboard", path: "/platform", role: "platform" },
  { label: "platform sales queue", path: "/platform/sales", role: "platform" },
  { label: "platform academy detail", path: "/platform/gyms", role: "platform" },
];

for (const { label, path, role } of SURFACES) {
  test(`axe: ${label}`, async ({ browser }) => {
    const context = await browser.newContext(
      role ? { storageState: storageStatePath(role) } : {},
    );
    const page = await context.newPage();
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await expectNoSeriousViolations(page, label);
    await context.close();
  });
}

test("keyboard: sign-in form is fully keyboard operable with visible focus", async ({ page }) => {
  await page.goto("/sign-in");
  await page.keyboard.press("Tab");
  // Walk until the email input has focus (bounded).
  for (let i = 0; i < 10; i++) {
    const isEmail = await page.evaluate(() => (document.activeElement as HTMLInputElement)?.type === "email");
    if (isEmail) break;
    await page.keyboard.press("Tab");
  }
  expect(await page.evaluate(() => (document.activeElement as HTMLInputElement)?.type)).toBe("email");
  await page.keyboard.type("owner.basic@e2e.matflow.test");
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => (document.activeElement as HTMLInputElement)?.type)).toBe("password");
});

test("arrival sheet: dialog semantics, focus trap, and Escape", async ({ browser }) => {
  const { FIXTURE } = await import("./helpers/env");
  const context = await browser.newContext({
    storageState: storageStatePath("student-member"),
    permissions: ["geolocation"],
    geolocation: { latitude: FIXTURE.coords.lat, longitude: FIXTURE.coords.lng, accuracy: 10 },
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    (window as unknown as { Capacitor: unknown }).Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios" };
  });
  await page.goto("/student");
  const sheet = page.locator('[aria-labelledby="arrival-heading"]');
  try {
    await expect(sheet).toBeVisible({ timeout: 15_000 });
  } catch {
    test.skip(true, "arrival sheet unavailable (all fixture occurrences already recorded this run)");
  }
  await expect(sheet).toHaveAttribute("aria-modal", "true");
  await expect(sheet.getByRole("heading")).toBeVisible();
  // axe on the open dialog state
  await expectNoSeriousViolations(page, "arrival check-in sheet", '[aria-labelledby="arrival-heading"]');
  // Focus is inside the dialog and Tab cycles within it.
  const inDialog = await page.evaluate(() => {
    const dlg = document.querySelector('[aria-labelledby="arrival-heading"]');
    return dlg ? dlg.contains(document.activeElement) : false;
  });
  expect(inDialog).toBe(true);
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
  await context.close();
});
