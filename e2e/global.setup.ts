import { test as setup, expect, chromium } from "@playwright/test";
import { execFileSync } from "child_process";
import fs from "fs";
import { AUTH_DIR, E2E_DATABASE_URL, E2E_PORT, FIXTURE, storageStatePath } from "./helpers/env";
import { seed, disconnect } from "./helpers/seed";

/**
 * Runs once before every suite (Playwright "setup" project):
 * 1. Sync the Prisma schema into the isolated E2E database (db push).
 * 2. Seed deterministic fixtures (idempotent).
 * 3. Sign in through the REAL UI once per role and persist storageState.
 */

const ROLES: { role: string; email: string; landing: RegExp }[] = [
  { role: "owner-trial", email: FIXTURE.emails.ownerTrial, landing: /\/app$/ },
  { role: "owner-basic", email: FIXTURE.emails.ownerBasic, landing: /\/app$/ },
  { role: "owner-pro", email: FIXTURE.emails.ownerPro, landing: /\/app$/ },
  { role: "owner-locked", email: FIXTURE.emails.ownerLocked, landing: /\/app/ },
  { role: "member", email: FIXTURE.emails.member, landing: /\/app/ },
  { role: "student-member", email: FIXTURE.emails.studentMember, landing: /\/student$/ },
  { role: "student-solo", email: FIXTURE.emails.studentSolo, landing: /\/student$/ },
  { role: "platform", email: FIXTURE.emails.platform, landing: /\/(app|platform)/ },
];

setup("prepare database, fixtures, and per-role sessions", async () => {
  setup.setTimeout(240_000);

  // 1. Schema sync (safe: URL already passed the localhost/approved-name gate)
  execFileSync("npx", ["prisma", "db", "push", "--skip-generate"], {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: E2E_DATABASE_URL, DIRECT_URL: E2E_DATABASE_URL },
  });

  // 2. Fixtures — the platform account also needs a login identity. It is a
  //    Member at the Pro gym so authenticateUser resolves it; platform access
  //    itself comes solely from PLATFORM_ADMIN_EMAILS.
  const ids = await seed();
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient({ datasources: { db: { url: E2E_DATABASE_URL } } });
  const bcrypt = (await import("bcryptjs")).default;
  const hash = await bcrypt.hash(FIXTURE.password, 10);
  await prisma.member.upsert({
    where: { gymId_email: { gymId: ids.gyms.pro, email: FIXTURE.emails.platform } },
    update: { passwordHash: hash, approved: true, active: true },
    create: {
      gymId: ids.gyms.pro,
      email: FIXTURE.emails.platform,
      clerkUserId: `e2e-${FIXTURE.emails.platform}`,
      firstName: "Frank",
      lastName: "Founder",
      passwordHash: hash,
      approved: true,
      active: true,
    },
  });
  await prisma.$disconnect();
  await disconnect();
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  fs.writeFileSync(`${AUTH_DIR}/fixture-ids.json`, JSON.stringify(ids, null, 2));
  // NOTE: e2e/helpers/reseed.ts republishes this map whenever fixtures are
  // reseeded mid-run (visual capture); functional specs read it per test.

  // 3. UI logins -> storageState per role
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  const browser = await chromium.launch();
  for (const { role, email, landing } of ROLES) {
    const context = await browser.newContext({ baseURL: `http://localhost:${E2E_PORT}` });
    const page = await context.newPage();
    // Up to two attempts: the very first page after a cold server boot can
    // submit natively (GET) if the click lands before React hydration.
    for (let attempt = 0; attempt < 2; attempt++) {
      await page.goto("/sign-in");
      await page.waitForLoadState("networkidle");
      await page.locator('input[type="email"]').fill(email);
      await page.locator('input[type="password"]').fill(FIXTURE.password);
      await page.getByRole("button", { name: /sign in/i }).click();
      try {
        await expect(page).toHaveURL(landing, { timeout: 15_000 });
        break;
      } catch (err) {
        if (attempt === 1) throw err;
      }
    }
    await context.storageState({ path: storageStatePath(role) });
    await context.close();
  }
  await browser.close();
});
