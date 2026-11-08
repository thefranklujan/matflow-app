/**
 * Phase 0, item 1 (audit C1): platform admin came from the session email, and
 * anyone could register a Student with an address in PLATFORM_ADMIN_EMAILS.
 * Oracle: docs/audit-2026-11-08/reproductions.md "C1".
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import bcrypt from "bcryptjs";

const LISTED = "p0-listed-admin@p0.matflow.test"; // in the env list AND has a Member row
const GHOST = "p0-ghost-admin@p0.matflow.test"; // in the env list, no rows at all
vi.hoisted(() => {
  process.env.PLATFORM_ADMIN_EMAILS = "p0-listed-admin@p0.matflow.test,p0-ghost-admin@p0.matflow.test";
});

vi.mock("next/headers", async () => (await import("@/test/integration")).nextHeadersMock);
vi.mock("@/lib/prisma", async () => ({ prisma: (await import("@/test/integration")).testPrisma }));
vi.mock("@/lib/email", async () => (await import("@/test/integration")).emailMock);

import {
  db, dbConfigured, jar, req, params, navigationOutcome, cleanupFixtures, makeGym, makeOwner,
  email, PASSWORD, fixtureHash, trackEmail,
} from "@/test/integration";
import { createSession } from "@/lib/local-auth";
import { POST as studentSignup } from "@/app/api/auth/student-signup/route";
import { POST as login } from "@/app/api/auth/login/route";
import { GET as sessionRoute } from "@/app/api/auth/session/route";
import { GET as platformActivity } from "@/app/api/platform/activity/route";
import { POST as impersonateGym } from "@/app/api/platform/impersonate/[gymId]/route";
import PlatformLayout from "@/app/platform/layout";
import StudentsPage from "@/app/platform/students/page";
import GymsListPage from "@/app/platform/gyms/page";
import PlatformDashboard from "@/app/platform/page";

type M = { id: string; gymId: string; clerkUserId: string; email: string; firstName: string; lastName: string };
async function signInMember(m: M, role: "admin" | "member" = "member") {
  await createSession({
    userId: m.clerkUserId, email: m.email, name: `${m.firstName} ${m.lastName}`,
    role, gymId: m.gymId, memberId: m.id, userType: "member",
  });
}
const signupBody = (addr: string) => ({ firstName: "Mal", lastName: "Lory", email: addr, password: "hunter22-long-enough", role: "student" });

describe.skipIf(!dbConfigured)("C1: platform admin is a server-side flag, never an email", () => {
  let gymId: string;
  let flagged: M;
  let listedUnflagged: M;

  beforeAll(async () => {
    trackEmail(LISTED);
    trackEmail(GHOST);
    await cleanupFixtures();
    const gym = await makeGym();
    gymId = gym.id;
    await makeOwner(gymId);
    flagged = await db().member.create({
      data: {
        gymId, clerkUserId: `staff-${Date.now()}`, email: email("staff"), firstName: "Fran", lastName: "Staff",
        passwordHash: await fixtureHash(), isPlatformAdmin: true,
      },
    });
    listedUnflagged = await db().member.create({
      data: {
        gymId, clerkUserId: `staff2-${Date.now()}`, email: LISTED, firstName: "Lis", lastName: "Ted",
        passwordHash: await fixtureHash(),
      },
    });
  });
  afterAll(cleanupFixtures);
  beforeEach(() => jar.clear());

  it("student-signup refuses an email that already exists as a Member", async () => {
    const res = await studentSignup(req("/api/auth/student-signup", { body: signupBody(LISTED) }));
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(await db().student.findUnique({ where: { email: LISTED } })).toBeNull();
    expect(jar.get("matflow-session")).toBeUndefined();
  });

  it("an address in PLATFORM_ADMIN_EMAILS grants nothing to whoever registers it", async () => {
    const res = await studentSignup(req("/api/auth/student-signup", { body: signupBody(GHOST) }));
    expect(res.status).toBe(201);

    const session = await (await sessionRoute()).json();
    expect(session.authenticated).toBe(true);
    expect(session.isPlatformAdmin).toBe(false);

    expect(await navigationOutcome(PlatformLayout({ children: null }))).toBe("redirect");
    expect([401, 403]).toContain((await platformActivity(req("/api/platform/activity"))).status);
    expect((await impersonateGym(req(`/api/platform/impersonate/${gymId}`, { method: "POST" }), params({ gymId }))).status).toBe(403);
  });

  it("a Member with the flag is a platform admin; a listed email without the flag is not", async () => {
    await signInMember(flagged);
    expect((await (await sessionRoute()).json()).isPlatformAdmin).toBe(true);
    expect(await navigationOutcome(PlatformLayout({ children: null }))).toBe("rendered");
    expect((await platformActivity(req("/api/platform/activity"))).status).toBe(200);

    jar.clear();
    await signInMember(listedUnflagged);
    expect((await (await sessionRoute()).json()).isPlatformAdmin).toBe(false);
    expect(await navigationOutcome(PlatformLayout({ children: null }))).toBe("redirect");
    expect([401, 403]).toContain((await platformActivity(req("/api/platform/activity"))).status);
  });

  it("a pre-hotfix token shape (no userType) naming a flagged member is not a platform session", async () => {
    // The old exit/impersonate routes minted exactly this for any email a cookie named.
    await createSession({
      userId: flagged.clerkUserId, email: flagged.email, name: "Fran Staff",
      role: "admin", gymId: flagged.gymId, memberId: flagged.id,
    });
    expect((await (await sessionRoute()).json()).isPlatformAdmin).toBe(false);
    expect(await navigationOutcome(PlatformLayout({ children: null }))).toBe("redirect");
    expect([401, 403]).toContain((await platformActivity(req("/api/platform/activity"))).status);
  });

  it("platform data pages check for themselves, not only through the layout", async () => {
    await signInMember(listedUnflagged);
    for (const page of [StudentsPage, GymsListPage, PlatformDashboard]) {
      expect(await navigationOutcome(page())).toBe("redirect");
    }
    jar.clear();
    await signInMember(flagged);
    for (const page of [StudentsPage, GymsListPage, PlatformDashboard]) {
      expect(await navigationOutcome(page())).toBe("rendered");
    }
  });

  it("login tries every Member row with the email, so a stray row cannot lock the admin out", async () => {
    const otherGym = await makeGym();
    // An older, self-joined row with the same address and someone else's password.
    await db().member.create({
      data: {
        gymId: otherGym.id, clerkUserId: `member-${Date.now()}`, email: flagged.email, firstName: "Imp",
        lastName: "Oster", passwordHash: await bcrypt.hash("someone-elses-password", 4), createdAt: new Date("2019-01-01T00:00:00Z"),
      },
    });
    const res = await (await login(req("/api/auth/login", { body: { email: flagged.email, password: PASSWORD } }))).json();
    expect(res.success).toBe(true);
    expect(res.isPlatformAdmin).toBe(true);
  });

  it("login reports isPlatformAdmin from the flag, not the env list", async () => {
    const asFlagged = await (await login(req("/api/auth/login", { body: { email: flagged.email, password: PASSWORD } }))).json();
    expect(asFlagged.isPlatformAdmin).toBe(true);
    jar.clear();
    const asListed = await (await login(req("/api/auth/login", { body: { email: LISTED, password: PASSWORD } }))).json();
    expect(asListed.success).toBe(true);
    expect(asListed.isPlatformAdmin).toBe(false);
  });
});
