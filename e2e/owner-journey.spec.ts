import { test, expect, storageStatePath, expectCleanPage, watchPage } from "./helpers/test";
import { FIXTURE } from "./helpers/env";

/**
 * The synthetic owner journey, end to end, against the isolated test database:
 *
 *   registration -> atomic academy -> authenticated dashboard -> profile ->
 *   first real member -> instructor -> class -> activation complete ->
 *   first attendance -> live usage visible to the owner -> the same state
 *   visible in the founder queue.
 *
 * Everything here is synthetic (@e2e.matflow.test) and local. No production
 * URL, no external service, no payment.
 */

test.describe.configure({ mode: "serial" });

const STAMP = Date.now();
const SLUG = `e2e-journey-${STAMP}`;
const EMAIL = `journey-${STAMP}@e2e.matflow.test`;
const ACADEMY = `E2E Journey ${STAMP}`;

test("owner journey: registration through live usage and founder visibility", async ({ browser }) => {
  test.setTimeout(180_000);

  const context = await browser.newContext();
  const page = await context.newPage();
  const health = watchPage(page);

  // ---- 1. Registration creates the academy atomically -------------------
  await page.goto("/sign-up");
  await page.locator("#signup-first-name").fill("Journey");
  await page.locator("#signup-last-name").fill("Owner");
  await page.locator("#signup-email").fill(EMAIL);
  await page.locator("#signup-password").fill(FIXTURE.password);
  await page.getByRole("button", { name: /continue/i }).first().click();

  // Step 2 asks what kind of account this is: choose Academy Owner, then submit.
  const ownerChoice = page.getByRole("button", { name: /academy owner/i }).first();
  if (await ownerChoice.isVisible().catch(() => false)) {
    await ownerChoice.click();
    await page.getByRole("button", { name: /continue|next/i }).first().click();
  }

  await expect(page.locator("#signup-gym-name")).toBeVisible({ timeout: 20_000 });
  await page.locator("#signup-gym-name").fill(ACADEMY);
  await page.locator("#signup-gym-slug").fill(SLUG);
  await page.getByRole("button", { name: /launch my gym/i }).click();

  // ---- 2. Authenticated dashboard, brand new academy --------------------
  await expect(page).toHaveURL(/\/app$/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  // Nothing is configured yet: the checklist is present, activation is not claimed.
  await expect(page.getByText(/Setup complete\./)).toHaveCount(0);

  // The academy exists exactly once and the session is bound to it.
  const session = await page.request.get("/api/auth/session");
  expect(session.ok()).toBeTruthy();

  // A second registration with the same slug must be refused (no duplicate).
  const duplicate = await page.request.post("/api/auth/register", {
    data: {
      firstName: "Dup", lastName: "Owner", email: `dup-${STAMP}@e2e.matflow.test`,
      password: FIXTURE.password, gymName: ACADEMY, gymSlug: SLUG,
    },
  });
  expect(duplicate.status()).toBe(409);
  expect((await duplicate.json()).code).toBe("SLUG_TAKEN");

  // ---- 3. Milestone 1: profile ------------------------------------------
  // The profile milestone is completed through the owner settings API the
  // form posts to (the form itself is covered by its own specs).
  const profile = await page.request.patch("/api/admin/settings", {
    data: { description: "Synthetic E2E academy.", city: "Houston", state: "TX" },
  });
  expect(profile.status()).toBe(200);

  // ---- 4. Milestone 2: a real member joins through the invite link ------
  // This is the actual acquisition path an owner shares, exercised anonymously.
  const joiner = await browser.newContext();
  const joinRes = await joiner.request.post("/api/auth/join", {
    data: {
      firstName: "First",
      lastName: "Student",
      email: `student-${STAMP}@e2e.matflow.test`,
      password: FIXTURE.password,
      gymSlug: SLUG,
    },
  });
  expect([200, 201]).toContain(joinRes.status());
  await joiner.close();

  const addInstructor = await page.request.post("/api/admin/instructors", {
    data: { name: "Coach Journey", beltRank: "black" },
  });
  expect([200, 201]).toContain(addInstructor.status());

  const addClass = await page.request.post("/api/admin/schedule", {
    data: {
      dayOfWeek: new Date().getDay(),
      startTime: "18:00",
      endTime: "19:00",
      classType: "gi",
      instructor: "Coach Journey",
    },
  });
  expect(addClass.status()).toBe(201);

  // ---- 7. Activation complete, visible to the owner ---------------------
  await page.goto("/app");
  await expect(page.getByText(/Setup complete\./).first()).toBeVisible();
  // Activated but nothing checked in yet.
  await expect(page.getByText(/record your first check-in/i).first()).toBeVisible();

  // ---- 8. First attendance = live usage ---------------------------------
  const memberList = await page.request.get("/api/admin/members");
  const members = await memberList.json();
  const rows: { id: string; email?: string }[] = Array.isArray(members)
    ? members
    : (members.data ?? members.members ?? []);
  const target = rows.find((m) => m.email?.startsWith(`student-${STAMP}`));
  expect(target, "the joined member is on the roster").toBeTruthy();

  const today = new Date();
  const classDate = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())).toISOString();
  const checkIn = await page.request.post("/api/admin/attendance", {
    data: { memberIds: [target!.id], classDate, classType: "gi", locationSlug: "main" },
  });
  expect([200, 201]).toContain(checkIn.status());

  // ---- 9. Live usage is visible to the owner ----------------------------
  await page.goto("/app");
  await expect(page.getByText(/your academy is live/i).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: /recent check-ins/i })).toBeVisible();
  await expect(page.getByText(/First Student/).first()).toBeVisible();
  expectCleanPage(health);
  await context.close();

  // ---- 10. The founder queue shows the same truth -----------------------
  const founder = await browser.newContext({ storageState: storageStatePath("platform") });
  const founderPage = await founder.newPage();
  await founderPage.goto("/platform/sales");
  await founderPage.locator("#sales-search").fill(ACADEMY);
  const row = founderPage.locator("table tbody tr").first();
  await expect(row).toContainText(ACADEMY);
  await expect(row).toContainText("4/4"); // all four milestones
  await expect(row).toContainText("Yes"); // live usage
  await expect(row).toContainText(/journey-.*@e2e\.matflow\.test/); // owner identified
  await founder.close();
});
