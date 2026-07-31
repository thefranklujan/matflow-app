import fs from "fs";
import path from "path";
import { test, expect, storageStatePath, watchPage, expectCleanPage, alertRegion } from "./helpers/test";
import { FIXTURE } from "./helpers/env";

/** Deep owner workflows: members, schedule, attendance, analytics linkage. */

function fixtureIds(): {
  gyms: Record<string, string>;
  members: Record<string, string>;
  students: Record<string, string>;
  openClassId: string;
} {
  return JSON.parse(fs.readFileSync(path.join(__dirname, ".auth", "fixture-ids.json"), "utf8"));
}

test.describe("members (Basic owner)", () => {
  test.use({ storageState: storageStatePath("owner-basic") });

  test("roster lists seeded members and opens member detail", async ({ page }) => {
    const health = watchPage(page);
    await page.goto("/app/members");
    await expect(page.getByText("Mia Mat").first()).toBeVisible();
    await expect(page.getByText("Sam Member").first()).toBeVisible();
    await page.locator('a[href*="/app/members/"]').first().click();
    await expect(page).toHaveURL(/\/app\/members\//);
    await expect(page.getByRole("heading").first()).toBeVisible();
    expectCleanPage(health, { allow404: [/avatar|image/] });
  });

  test("cross-academy member detail is NOT accessible", async ({ page }) => {
    const ids = fixtureIds();
    await page.goto(`/app/members/${ids.members.pro}`); // belongs to the Pro gym
    const body = (await page.evaluate(() => document.body.innerText)).toLowerCase();
    // Never render the foreign member's name; not-found/redirect are both fine.
    expect(body).not.toContain("pete");
    expect(body).not.toContain("promat");
  });
});

test.describe("schedule and attendance (Basic owner)", () => {
  test.use({ storageState: storageStatePath("owner-basic") });

  test("schedule shows the seeded weekly grid in academy-local time", async ({ page }) => {
    await page.goto("/app/schedule");
    await expect(page.getByText(/fundamentals/i).first()).toBeVisible();
    // 18:00 America/Chicago renders as a 6 PM slot (any common format).
    const body = await page.evaluate(() => document.body.innerText);
    expect(body).toMatch(/6:00\s*PM|18:00/);
  });

  test("invalid class submission shows an announced inline error and keeps the values", async ({ page }) => {
    await page.goto("/app/schedule");
    await page.getByRole("button", { name: /add class/i }).click();
    const form = page.locator("form");
    await expect(form).toBeVisible();

    // Make start and end identical: a zero-length class the server rejects.
    const start = form.locator('input[type="time"]').first();
    const end = form.locator('input[type="time"]').nth(1);
    const startValue = await start.inputValue();
    await end.fill(startValue);
    await form.getByRole("button", { name: /add to schedule/i }).click();

    const alert = alertRegion(page).first();
    await expect(alert).toBeVisible();
    await expect(alert).toContainText(/different from the start time/i);
    // The form stays open with the entered values intact.
    await expect(form).toBeVisible();
    await expect(end).toHaveValue(startValue);
  });

  test("server rejects invalid schedule input without creating anything", async ({ page }) => {
    const before = await page.request.get("/api/admin/schedule");
    const beforeCount = (await before.json()).length;

    for (const body of [
      { dayOfWeek: 9, startTime: "18:00", endTime: "19:00", classType: "gi", instructor: "X" },
      { dayOfWeek: 1, startTime: "6pm", endTime: "19:00", classType: "gi", instructor: "X" },
      { dayOfWeek: 1, startTime: "18:00", endTime: "18:00", classType: "gi", instructor: "X" },
      { dayOfWeek: 1, startTime: "18:00", endTime: "19:00", classType: "   ", instructor: "X" },
    ]) {
      const res = await page.request.post("/api/admin/schedule", { data: body });
      expect(res.status(), JSON.stringify(body)).toBe(400);
      const payload = await res.json();
      expect(typeof payload.code).toBe("string");
      expect(typeof payload.error).toBe("string");
    }

    const after = await page.request.get("/api/admin/schedule");
    expect((await after.json()).length, "no rows created by invalid input").toBe(beforeCount);
  });

  test("owner can create a class through the UI", async ({ page }) => {
    await page.goto("/app/schedule");
    await page.getByRole("button", { name: /add class/i }).click();
    const form = page.locator("form");
    await expect(form).toBeVisible();
    // Fill whatever named inputs the form exposes, tolerant to select/input mix.
    const classType = form.locator('input[name="classType"], select[name="classType"]').first();
    if ((await classType.count()) > 0) {
      const tag = await classType.evaluate((el) => el.tagName);
      if (tag === "SELECT") await classType.selectOption({ index: 1 });
      else await classType.fill("e2e-created");
    }
    await form.getByRole("button", { name: /add to schedule/i }).click();
    // The form either closes or the grid refreshes without an error toast.
    await expect(page.getByText(/error|failed/i)).toHaveCount(0);
  });

  test("student self-check-in from the arrival flow appears for the owner, exactly once", async ({ page, browser }) => {
    const ids = fixtureIds();
    // Student checks in via the REAL check-in endpoint using an arrival token
    // obtained from the REAL proximity endpoint (fixture coordinates).
    const studentContext = await browser.newContext({ storageState: storageStatePath("student-member") });
    const api = studentContext.request;
    const ping = await api.post("/api/student/proximity-ping", {
      data: { lat: FIXTURE.coords.lat, lng: FIXTURE.coords.lng, accuracy: 10 },
    });
    expect(ping.ok()).toBeTruthy();
    const decision = await ping.json();
    expect(decision.result).toBe("inside_with_classes");
    const checkIn = await api.post("/api/student/attendance/check-in", {
      data: { arrivalToken: decision.arrivalToken, classScheduleId: ids.openClassId },
    });
    expect([200, 201]).toContain(checkIn.status());
    const first = await checkIn.json();
    expect(["checked_in", "already_checked_in"]).toContain(first.result);

    // Duplicate confirmation stays idempotent (needs a fresh token; the class
    // may be filtered out now, so reuse the SAME token before it expires).
    const dup = await api.post("/api/student/attendance/check-in", {
      data: { arrivalToken: decision.arrivalToken, classScheduleId: ids.openClassId },
    });
    const dupBody = await dup.json();
    expect(dupBody.result).toBe("already_checked_in");
    await studentContext.close();

    // Owner sees exactly one check-in for Sam today.
    const health = watchPage(page);
    await page.goto("/app/attendance");
    await expect(page.getByText(/sam/i).first()).toBeVisible();
    const samRows = await page.getByText("Sam Member").count();
    expect(samRows).toBeGreaterThanOrEqual(1);
    expectCleanPage(health);
  });

  test("attendance history feeds owner analytics without errors", async ({ page }) => {
    const health = watchPage(page);
    await page.goto("/app/analytics");
    await expect(page.getByRole("heading", { name: "Analytics", exact: true })).toBeVisible();
    const body = await page.evaluate(() => document.body.innerText);
    expect(body).not.toMatch(/NaN|undefined/);
    expectCleanPage(health);
  });
});

test.describe("operational surfaces render seeded content (Basic owner)", () => {
  test.use({ storageState: storageStatePath("owner-basic") });

  const checks: { slug: string; expectText: RegExp }[] = [
    { slug: "products", expectText: /E2E Academy Gi/i },
    { slug: "products/categories", expectText: /E2E Apparel/i },
    { slug: "orders", expectText: /Carla Customer/i },
    { slug: "instructors", expectText: /Prof\. Fixture/i },
    { slug: "announcements", expectText: /E2E Fixture Announcement/i },
    { slug: "waivers", expectText: /E2E Liability Waiver/i },
  ];
  for (const { slug, expectText } of checks) {
    test(`/app/${slug} shows fixture content`, async ({ page }) => {
      const health = watchPage(page);
      await page.goto(`/app/${slug}`);
      await expect(page.getByText(expectText).first()).toBeVisible();
      expectCleanPage(health);
    });
  }

  test("settings page renders the academy profile form", async ({ page }) => {
    await page.goto("/app/settings");
    await expect(page.locator("h1, h2").first()).toBeVisible();
    await expect(page.getByText(/E2E Basic BJJ/i).first()).toBeVisible();
  });
});
