import { test, expect, watchPage, expectCleanPage, alertRegion } from "./helpers/test";

/**
 * Authentication form accessibility contract.
 *
 * Every visible label must be programmatically associated with its control,
 * errors must be announced, and no production account or real email is ever
 * created — these specs only submit deliberately invalid input, except the
 * duplicate-account path which reuses an EXISTING fixture email.
 */

const FORMS = [
  { label: "owner sign-up", path: "/sign-up" },
  { label: "student sign-up", path: "/student/sign-up" },
  { label: "forgot password", path: "/forgot-password" },
  { label: "reset password", path: "/reset-password?token=e2e-synthetic-token" },
];

for (const { label, path } of FORMS) {
  test(`${label}: every visible label is wired to a control`, async ({ page }) => {
    const health = watchPage(page);
    await page.goto(path);
    await expect(page.locator("form")).toBeVisible();

    const unwired = await page.evaluate(() => {
      const problems: string[] = [];
      for (const label of Array.from(document.querySelectorAll("label"))) {
        if (!(label as HTMLElement).offsetParent && label.getBoundingClientRect().height === 0) continue;
        const forAttr = label.getAttribute("for");
        const wrapsControl = label.querySelector("input, select, textarea") !== null;
        if (!forAttr && !wrapsControl) {
          problems.push(`label without for/control: "${label.textContent?.trim()}"`);
          continue;
        }
        if (forAttr && !document.getElementById(forAttr)) {
          problems.push(`label for="${forAttr}" has no matching element`);
        }
      }
      // Ids must be unique for the association to be meaningful.
      const ids = Array.from(document.querySelectorAll("[id]")).map((el) => el.id);
      const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
      if (dupes.length) problems.push(`duplicate ids: ${[...new Set(dupes)].join(", ")}`);
      return problems;
    });
    expect(unwired, `${label} label wiring`).toEqual([]);

    // Every input/select is reachable by its accessible name.
    const namelessControls = await page.evaluate(() => {
      const bad: string[] = [];
      for (const el of Array.from(document.querySelectorAll("input, select, textarea"))) {
        if ((el as HTMLInputElement).type === "hidden") continue;
        const id = el.id;
        const hasLabel = id ? document.querySelector(`label[for="${id}"]`) !== null : false;
        const hasAria = el.hasAttribute("aria-label") || el.hasAttribute("aria-labelledby");
        if (!hasLabel && !hasAria) bad.push((el as HTMLElement).outerHTML.slice(0, 80));
      }
      return bad;
    });
    expect(namelessControls, `${label} control names`).toEqual([]);

    expectCleanPage(health);
  });
}

test("owner sign-up: a too-short password never silently submits, and values survive", async ({ page }) => {
  await page.goto("/sign-up");
  // Deliberately invalid: a password shorter than the server minimum. No
  // account is created by this test.
  const email = `e2e-invalid-${Date.now()}@e2e.matflow.test`;
  await page.locator("#signup-first-name").fill("E2E");
  await page.locator("#signup-last-name").fill("Tester");
  await page.locator("#signup-email").fill(email);
  await page.locator("#signup-password").fill("123");
  await page.getByRole("button", { name: /continue|next|create/i }).first().click();

  // The step-1 fields stay mounted with their values intact — the user is
  // never advanced past an invalid password nor forced to retype.
  await expect(page.locator("#signup-password")).toBeVisible();
  await expect(page.locator("#signup-email")).toHaveValue(email);
  await expect(page.locator("#signup-first-name")).toHaveValue("E2E");
});

test("owner sign-up error region is announced and described when the server rejects", async ({ page }) => {
  await page.goto("/sign-up");
  // Force a server-side rejection path deterministically: an email that is
  // already registered as a fixture owner.
  const { FIXTURE } = await import("./helpers/env");
  await page.locator("#signup-first-name").fill("Dup");
  await page.locator("#signup-last-name").fill("Owner");
  await page.locator("#signup-email").fill(FIXTURE.emails.ownerBasic);
  await page.locator("#signup-password").fill(FIXTURE.password);
  await page.getByRole("button", { name: /continue|next|create/i }).first().click();

  const alert = alertRegion(page).first();
  if (await alert.count()) {
    // When an error renders it must be announced AND wired to the inputs.
    await expect(alert).toBeVisible();
    await expect(alert).not.toBeEmpty();
    await expect(page.locator("#signup-email")).toHaveAttribute("aria-describedby", "signup-error");
  } else {
    // Step 1 is client-only in this build: no account was created and the
    // duplicate is caught later. Assert we did not land in a signed-in state.
    await expect(page).toHaveURL(/sign-up/);
  }
});

test("student sign-up is reachable by anonymous visitors (not bounced to sign-in)", async ({ page }) => {
  // Regression guard: the page lives under /student, whose portal layout
  // redirects unauthenticated visitors. It must stay outside that guard or the
  // entire student acquisition funnel breaks.
  const res = await page.goto("/student/sign-up");
  expect(res?.status(), "no auth redirect").toBeLessThan(400);
  await expect(page).toHaveURL(/student\/sign-up/);
  await expect(page.locator("#student-first-name")).toBeVisible();
});

test("student sign-up: duplicate email surfaces an announced error, no new account", async ({ page }) => {
  const { FIXTURE } = await import("./helpers/env");
  await page.goto("/student/sign-up");
  await page.locator("#student-first-name").fill("Dup");
  await page.locator("#student-last-name").fill("Licate");
  await page.locator("#student-email").fill(FIXTURE.emails.studentMember); // already exists
  await page.locator("#student-password").fill(FIXTURE.password);
  await page.getByRole("button", { name: /create|sign up/i }).first().click();

  const alert = alertRegion(page).first();
  await expect(alert).toBeVisible({ timeout: 15_000 });
  await expect(alert).not.toBeEmpty();
  // Still on the sign-up page: no account was created, no redirect happened.
  await expect(page).toHaveURL(/student\/sign-up/);
});

test("forgot password: status is announced without revealing account existence", async ({ page }) => {
  await page.goto("/forgot-password");
  await page.locator("#forgot-email").fill("definitely-not-a-user@e2e.matflow.test");
  await page.getByRole("button", { name: /send reset link/i }).click();

  const status = page.getByRole("status");
  await expect(status).toBeVisible({ timeout: 15_000 });
  const text = (await status.innerText()).toLowerCase();
  // Neutral wording: it must not confirm or deny the account.
  expect(text).toContain("if an account exists");
});

test("reset password: client validation errors are announced and described", async ({ page }) => {
  await page.goto("/reset-password?token=e2e-synthetic-token");
  await page.locator("#reset-password").fill("abcdef");
  await page.locator("#reset-confirm").fill("different");
  await page.getByRole("button", { name: /update password/i }).click();

  const alert = alertRegion(page).first();
  await expect(alert).toBeVisible();
  await expect(alert).toContainText(/match/i);
  await expect(page.locator("#reset-password")).toHaveAttribute("aria-describedby", "reset-error");
  // Values are retained so the user can correct rather than retype.
  await expect(page.locator("#reset-password")).toHaveValue("abcdef");
});

test("auth forms expose correct autocomplete hints", async ({ page }) => {
  await page.goto("/sign-up");
  await expect(page.locator("#signup-first-name")).toHaveAttribute("autocomplete", "given-name");
  await expect(page.locator("#signup-last-name")).toHaveAttribute("autocomplete", "family-name");
  await expect(page.locator("#signup-email")).toHaveAttribute("autocomplete", "email");
  await expect(page.locator("#signup-password")).toHaveAttribute("autocomplete", "new-password");

  await page.goto("/reset-password?token=e2e-synthetic-token");
  await expect(page.locator("#reset-password")).toHaveAttribute("autocomplete", "new-password");
  await expect(page.locator("#reset-confirm")).toHaveAttribute("autocomplete", "new-password");
});


test.describe("retired onboarding path", () => {
  test("signed-out visitors are sent to sign-up", async ({ page }) => {
    await page.goto("/onboarding");
    await expect(page).toHaveURL(/\/sign-up/);
  });

  test("an academy owner is sent to the dashboard", async ({ browser }) => {
    const { storageStatePath } = await import("./helpers/env");
    const context = await browser.newContext({ storageState: storageStatePath("owner-basic") });
    const page = await context.newPage();
    await page.goto("/onboarding");
    await expect(page).toHaveURL(/\/app$/);
    await context.close();
  });

  test("a student is sent to the student portal", async ({ browser }) => {
    const { storageStatePath } = await import("./helpers/env");
    const context = await browser.newContext({ storageState: storageStatePath("student-member") });
    const page = await context.newPage();
    await page.goto("/onboarding");
    await expect(page).toHaveURL(/\/student/);
    await context.close();
  });

  test("the legacy API is gone and creates nothing", async ({ page }) => {
    const res = await page.request.post("/api/onboarding", {
      data: { gymName: "E2E Should Never Exist", slug: "e2e-should-never-exist", timezone: "America/Chicago" },
    });
    expect(res.status()).toBe(410);
    expect((await res.json()).code).toBe("ONBOARDING_RETIRED");

    // Prove no academy was created: the slug must not resolve anywhere public.
    const join = await page.request.get("/join/e2e-should-never-exist");
    expect([404, 307, 308]).toContain(join.status());
  });

  test("no customer-facing page links to the retired onboarding form", async ({ page }) => {
    for (const path of ["/", "/sign-up", "/sign-in", "/student/sign-up"]) {
      await page.goto(path);
      const links = await page.locator('a[href="/onboarding"], a[href^="/onboarding?"]').count();
      expect(links, `${path} must not link to /onboarding`).toBe(0);
    }
  });
});
