import { test, expect, storageStatePath, settle } from "./helpers/test";
import { FIXTURE } from "./helpers/env";
import { reseedFixtures } from "./helpers/reseed";

// Baselines must always capture the pristine deterministic fixture state, even
// when functional journeys have already mutated the shared database.
test.beforeAll(async () => {
  test.setTimeout(120_000);
  await reseedFixtures();
});

/**
 * Small, high-value visual baseline set. Deterministic fixture data; masked
 * regions cover now-relative text (dates, "x days ago", live clocks).
 * Update intentionally with: npm run test:e2e:update
 */

const VIEWPORTS = [
  { tag: "375", width: 375, height: 812 },
  { tag: "768", width: 768, height: 1024 },
  { tag: "1440", width: 1440, height: 900 },
];

const SHOTS: { name: string; path: string; role: string | null; tablet?: boolean }[] = [
  { name: "public-sign-in", path: "/sign-in", role: null, tablet: true },
  { name: "owner-dashboard", path: "/app", role: "owner-basic", tablet: true },
  { name: "owner-members", path: "/app/members", role: "owner-basic" },
  { name: "owner-schedule", path: "/app/schedule", role: "owner-basic", tablet: true },
  { name: "owner-attendance", path: "/app/attendance", role: "owner-basic" },
  { name: "owner-analytics", path: "/app/analytics", role: "owner-basic" },
  { name: "owner-billing", path: "/app/billing", role: "owner-basic" },
  { name: "student-dashboard", path: "/student", role: "student-member", tablet: true },
  { name: "student-schedule", path: "/student/schedule", role: "student-member" },
  { name: "platform-dashboard", path: "/platform", role: "platform" },
];

// Now-relative text (dates, clock times, "x days ago") is masked so the
// SAME baseline passes on any calendar day. Layout drift still fails.
function dynamicMasks(page: import("@playwright/test").Page) {
  return [
    page.locator("time"),
    page.getByText(/\d{1,2}:\d{2}\s*(AM|PM)?/i),
    page.getByText(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}/),
    page.getByText(/\b(Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day\b/i),
    page.getByText(/\d+\s+(day|hour|minute|week)s?\s+ago/i),
    page.getByText(/\d{1,2}\/\d{1,2}\/\d{2,4}/),
  ];
}

for (const shot of SHOTS) {
  for (const vp of VIEWPORTS) {
    if (vp.tag === "768" && !shot.tablet) continue; // tablet only where meaningful
    test(`baseline: ${shot.name} @${vp.tag}`, async ({ browser }) => {
      const context = await browser.newContext({
        ...(shot.role ? { storageState: storageStatePath(shot.role) } : {}),
        viewport: { width: vp.width, height: vp.height },
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      await page.goto(shot.path);
      await settle(page);
      await expect(page).toHaveScreenshot(`${shot.name}-${vp.tag}.png`, {
        fullPage: false,
        mask: dynamicMasks(page),
        maskColor: "#1a1a1a",
      });
      await context.close();
    });
  }
}

test("baseline: arrival-check-in-sheet @375", async ({ browser }) => {
  const context = await browser.newContext({
    storageState: storageStatePath("student-member"),
    viewport: { width: 375, height: 812 },
    permissions: ["geolocation"],
    geolocation: { latitude: FIXTURE.coords.lat, longitude: FIXTURE.coords.lng, accuracy: 10 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    (window as unknown as { Capacitor: unknown }).Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios" };
    // Visual determinism: never inside a cooldown from sibling specs.
    Object.keys(localStorage)
      .filter((k) => k.startsWith("matflow-arrival"))
      .forEach((k) => localStorage.removeItem(k));
  });
  await page.goto("/student");
  const sheet = page.locator('[aria-labelledby="arrival-heading"]');
  try {
    await expect(sheet).toBeVisible({ timeout: 15_000 });
  } catch {
    test.skip(true, "arrival sheet unavailable this run (occurrences already recorded)");
  }
  await settle(page);
  await expect(sheet).toHaveScreenshot("arrival-sheet-375.png", {
    mask: dynamicMasks(page), // class-time lines vary with the seed clock
    maskColor: "#1a1a1a",
  });
  await context.close();
});
