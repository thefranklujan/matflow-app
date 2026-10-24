import fs from "fs";
import path from "path";
import { request as pwRequest, type APIRequestContext } from "@playwright/test";
import { test, expect, storageStatePath, watchPage, expectCleanPage, expectNoHorizontalOverflow, alertRegion } from "./helpers/test";
import { reseedFixtures } from "./helpers/reseed";
import { E2E_PORT } from "./helpers/env";

/**
 * Academy launch-readiness walkthrough (packets A–D, F) against the isolated
 * fixture database. Owner-side changes go through the owner's real API with
 * the owner's session; student-side behavior is observed in the real UI.
 * The suite mutates fixtures, so it reseeds before and after.
 */

function ids() {
  return JSON.parse(fs.readFileSync(path.join(__dirname, ".auth", "fixture-ids.json"), "utf8"));
}

async function asRole(role: string): Promise<APIRequestContext> {
  return pwRequest.newContext({ baseURL: `http://localhost:${E2E_PORT}`, storageState: storageStatePath(role) });
}

test.describe.configure({ mode: "serial" });
test.beforeAll(async () => reseedFixtures());
test.afterAll(async () => reseedFixtures());

test.describe("student academy view", () => {
  test.use({ storageState: storageStatePath("student-member") });

  test("C3: Open academy reaches that academy's page and Back returns home", async ({ page }) => {
    const health = watchPage(page);
    await page.goto("/student");
    await page.getByRole("button", { name: /E2E Basic BJJ.*Open academy/s }).filter({ visible: true }).click();
    await expect(page).toHaveURL(new RegExp(`/student/academy\\?gym=${ids().gyms.basic}`));
    await expect(page.getByRole("heading", { level: 1, name: "E2E Basic BJJ" }).filter({ visible: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Next classes/i }).filter({ visible: true })).toBeVisible();
    await expect(page.getByText("E2E Fixture Announcement").filter({ visible: true })).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/\/student$/);
    expectCleanPage(health);
  });

  test("B1/B4/B7: sign, owner revises, updated waiver shown, re-sign; stale form is refused", async ({ page }) => {
    const owner = await asRole("owner-basic");
    const templates = await (await owner.get("/api/admin/waivers")).json();
    const active = templates.find((t: { active: boolean }) => t.active);

    await page.goto(`/student/academy?gym=${ids().gyms.basic}#waiver`);
    const waiver = page.locator("#waiver:visible");
    await expect(waiver.getByText(/Your signature is needed for version/)).toBeVisible();
    await waiver.getByRole("checkbox").check();
    await waiver.getByLabel("Type your full name to sign").fill("Sam Member");
    await waiver.getByRole("button", { name: /Sign version/ }).click();
    await expect(waiver.getByText(/You signed the current version/)).toBeVisible();

    // Owner changes the wording -> new version.
    const edit = await owner.put("/api/admin/waivers", { data: { id: active.id, title: active.title, content: "Revised fixture waiver text v2." } });
    expect(edit.status()).toBe(200);
    const revised = await edit.json();

    await page.reload();
    await expect(waiver.getByText(/Updated waiver available/)).toBeVisible();
    await expect(waiver.getByText("Revised fixture waiver text v2.")).toBeVisible();

    // Stale form: owner revises again while the student has v(N) open.
    await waiver.getByRole("checkbox").check();
    await waiver.getByLabel("Type your full name to sign").fill("Sam Member");
    await owner.put("/api/admin/waivers", { data: { id: active.id, title: active.title, content: "Revised again v3." } });
    await waiver.getByRole("button", { name: /Sign version/ }).click();
    await expect(waiver.getByText(/updated after you opened it/i)).toBeVisible();
    await expect(waiver.getByText("Revised again v3.")).toBeVisible();
    await expect(waiver.getByRole("checkbox")).not.toBeChecked();

    await waiver.getByRole("checkbox").check();
    await waiver.getByRole("button", { name: /Sign version/ }).click();
    await expect(waiver.getByText(new RegExp(`current version \\(v${revised.version + 1}\\)`))).toBeVisible();

    // B7: the revision notification deep-links here.
    const inbox = await page.request.get("/api/notifications");
    if (inbox.ok()) {
      const body = JSON.stringify(await inbox.json());
      expect(body).toContain(`/student/academy?gym=${ids().gyms.basic}#waiver`);
    }
    await owner.dispose();
  });

  test("C1: an owner promotion shows as academy-verified rank; personal rank unchanged", async ({ page }) => {
    const owner = await asRole("owner-basic");
    const res = await owner.post(`/api/admin/members/${ids().members.sam}/promote`, { data: { beltRank: "purple", stripes: 1 } });
    expect(res.status()).toBe(201);
    await owner.dispose();

    await page.goto(`/student/academy?gym=${ids().gyms.basic}`);
    const progress = page.locator("#progress:visible");
    await expect(progress.getByText("Purple belt, 1 stripe").first()).toBeVisible();
    await expect(progress.getByText(/personal rank \(self-reported on your profile\): Blue belt/i)).toBeVisible();
  });

  test("D: mark a class as going (keyboard), persists after reload, and is labeled as a plan", async ({ page }) => {
    await page.goto(`/student/academy?gym=${ids().gyms.basic}`);
    const first = page.getByRole("button", { name: /^Plan to attend/ }).filter({ visible: true }).first();
    const label = await first.getAttribute("aria-label");
    await first.focus();
    await page.keyboard.press("Enter");
    const toggled = page.getByRole("button", { name: label!.replace("Plan to attend", "Remove plan for") }).filter({ visible: true });
    await expect(toggled).toHaveAttribute("aria-pressed", "true");
    await page.reload();
    await expect(page.getByRole("button", { name: label!.replace("Plan to attend", "Remove plan for") }).filter({ visible: true })).toBeVisible();
    await expect(page.getByText(/Attendance is recorded when you check in/).filter({ visible: true })).toBeVisible();
  });

  test("C6: another academy's id shows no private content", async ({ page }) => {
    await page.goto(`/student/academy?gym=${ids().gyms.pro}`);
    await expect(alertRegion(page).filter({ visible: true })).toContainText(/not an active member/i);
    await expect(page.getByText("E2E Pro BJJ")).toHaveCount(0);
    const api = await page.request.get(`/api/student/academy/${ids().gyms.pro}/waiver`);
    expect(api.status()).toBe(403);
  });

  test("C8: academy page at 390px has no overflow and named controls", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/student/academy?gym=${ids().gyms.basic}`);
    await expect(page.getByRole("heading", { level: 1, name: "E2E Basic BJJ" }).filter({ visible: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    const unnamed = await page.evaluate(() =>
      Array.from(document.querySelectorAll("main button, main a, main input")).filter((el) => {
        const e = el as HTMLElement;
        const name = e.getAttribute("aria-label") || e.innerText?.trim() || (e as HTMLInputElement).labels?.[0]?.innerText;
        return e.offsetParent !== null && !name;
      }).length,
    );
    expect(unnamed).toBe(0);
  });
});

test.describe("independent student", () => {
  test.use({ storageState: storageStatePath("student-solo") });

  test("C5: no membership shows a free join/discovery state, not an error or paywall", async ({ page }) => {
    const health = watchPage(page);
    await page.goto("/student/academy");
    await expect(page.getByText(/not an active member of an academy yet/i).filter({ visible: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /Find your academy/i }).filter({ visible: true })).toHaveAttribute("href", "/student/gyms");
    await expect(page.getByText(/\$49|\$99|trial/i)).toHaveCount(0);
    expectCleanPage(health);
  });

  test("A6: a student community sharing an academy's name stays listed as pending review", async ({ page }) => {
    const res = await page.request.post("/api/student/nominate", { data: { gymName: "E2E Trial BJJ", city: "Houston", state: "TX" } });
    expect(res.status()).toBe(201);
    await page.goto("/student/gyms?q=E2E%20Trial");
    await expect(page.getByText("Pending review").filter({ visible: true }).first()).toBeVisible();
  });
});

test.describe("owner export", () => {
  test.use({ storageState: storageStatePath("owner-basic") });

  test("F: Settings export downloads this academy's records only", async ({ page }) => {
    await page.goto("/app/settings");
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Export academy data" }).click(),
    ]);
    const file = await download.path();
    const data = JSON.parse(fs.readFileSync(file!, "utf8"));
    expect(data.format).toBe("matflow-academy-export");
    expect(data.academy.slug).toBe("e2e-basic-bjj");
    expect(data.members.length).toBe(data.manifest.counts.members);
    const text = JSON.stringify(data);
    expect(text).not.toContain("E2E Pro BJJ");
    expect(text).not.toContain("passwordHash");
    await expect(page.getByRole("status").filter({ hasText: /Downloaded/ })).toBeVisible();
  });

  test("F3: a student session cannot export an academy", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: storageStatePath("student-member") });
    const res = await ctx.request.get(`http://localhost:${E2E_PORT}/api/admin/export`);
    expect([401, 402, 403]).toContain(res.status());
    await ctx.close();
  });
});
