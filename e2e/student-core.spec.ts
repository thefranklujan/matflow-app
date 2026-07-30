import { test, expect, storageStatePath, watchPage, expectCleanPage, expectNoHorizontalOverflow } from "./helpers/test";

/** Student portal coverage (member-linked student unless stated). */

const STUDENT_PAGES = [
  "", "schedule", "training", "gyms", "requests", "notifications",
  "profile", "community", "leaderboard", "clock",
];

test.describe("student pages (member-linked student)", () => {
  test.use({ storageState: storageStatePath("student-member") });

  for (const slug of STUDENT_PAGES) {
    test(`/student/${slug || "(dashboard)"} renders cleanly`, async ({ page }) => {
      const health = watchPage(page);
      await page.goto(`/student/${slug}`);
      await expect(page.getByRole("heading").first()).toBeVisible();
      const textLength = await page.evaluate(() => document.body.innerText.trim().length);
      expect(textLength, "page is not blank").toBeGreaterThan(30);
      await expectNoHorizontalOverflow(page);
      expectCleanPage(health);
    });
  }

  test("dashboard shows the academy membership context", async ({ page }) => {
    await page.goto("/student");
    await expect(page.getByText(/E2E Basic BJJ/i).filter({ visible: true }).first()).toBeVisible();
  });

  test("gym discovery lists approved fixture academies", async ({ page }) => {
    await page.goto("/student/gyms");
    await expect(page.getByText(/E2E (Pro|Basic|Trial) BJJ/i).filter({ visible: true }).first()).toBeVisible();
  });

  test("owner surfaces are not reachable from a student session", async ({ page }) => {
    await page.goto("/app/members");
    await expect(page).toHaveURL(/\/student/);
  });
});

test.describe("independent student", () => {
  test.use({ storageState: storageStatePath("student-solo") });

  test("dashboard renders without any academy membership", async ({ page }) => {
    const health = watchPage(page);
    await page.goto("/student");
    await expect(page.getByRole("heading").first()).toBeVisible();
    expectCleanPage(health);
  });

  test("join-request workflow: pending request is visible", async ({ page }) => {
    await page.goto("/student/requests");
    await expect(page.getByText(/E2E Pro BJJ/i).filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText(/pending/i).filter({ visible: true }).first()).toBeVisible();
  });

  test("cannot read another student's training data", async ({ page }) => {
    // The member-linked student has training sessions; the solo student's log
    // must not contain them.
    await page.goto("/student/training");
    const body = await page.evaluate(() => document.body.innerText);
    expect(body).not.toMatch(/Sam Member/);
  });

  test("proximity eligibility is denied without an active membership", async ({ page }) => {
    const res = await page.request.get("/api/student/proximity-ping");
    const body = await res.json();
    expect(body.eligible).toBeFalsy();
  });
});

test.describe("cross-tenant isolation (student-member of Basic gym)", () => {
  test.use({ storageState: storageStatePath("student-member") });

  test("student cannot check in against another gym's class", async ({ page }) => {
    test.skip(test.info().project.name === "mobile", "single-shot journey; runs on desktop");
    // Proximity endpoint only ever issues tokens for the OWN membership's gym;
    // a schedule id from another gym must 404 at check-in.
    const fs = await import("fs");
    const path = await import("path");
    const ids = JSON.parse(fs.readFileSync(path.join(__dirname, ".auth", "fixture-ids.json"), "utf8"));
    const ping = await page.request.post("/api/student/proximity-ping", {
      data: { lat: 29.7604, lng: -95.3698, accuracy: 10 },
    });
    const decision = await ping.json();
    expect(decision.result).toBe("inside_with_classes");
    // A REAL schedule that belongs to the PRO gym must be rejected.
    const res = await page.request.post("/api/student/attendance/check-in", {
      data: { arrivalToken: decision.arrivalToken, classScheduleId: ids.proOpenClassId },
    });
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.result).toBe("class_not_found");
  });
});
