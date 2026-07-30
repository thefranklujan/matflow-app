import { test, expect, storageStatePath, expectNoHorizontalOverflow } from "./helpers/test";

/**
 * Responsive smoke: key pages must not overflow horizontally and must keep
 * their primary heading visible at every supported width.
 */

const WIDTHS = [
  { name: "mobile-small", width: 320, height: 568 },
  { name: "iphone", width: 375, height: 812 },
  { name: "mobile-wide", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
];

const PAGES: { path: string; role: string | null }[] = [
  { path: "/", role: null },
  { path: "/sign-in", role: null },
  { path: "/app", role: "owner-basic" },
  { path: "/app/members", role: "owner-basic" },
  { path: "/app/schedule", role: "owner-basic" },
  { path: "/app/analytics", role: "owner-basic" },
  { path: "/app/billing", role: "owner-basic" },
  { path: "/student", role: "student-member" },
  { path: "/student/schedule", role: "student-member" },
];

for (const { path, role } of PAGES) {
  test(`responsive: ${path}`, async ({ browser }) => {
    test.setTimeout(90_000);
    const context = await browser.newContext(role ? { storageState: storageStatePath(role) } : {});
    const page = await context.newPage();
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w.width, height: w.height });
      await page.goto(path);
      await expect(page.getByRole("heading").first()).toBeVisible();
      await expectNoHorizontalOverflow(page);
    }
    await context.close();
  });
}
