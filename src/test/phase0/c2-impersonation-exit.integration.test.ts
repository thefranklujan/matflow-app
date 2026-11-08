/**
 * Phase 0, item 2 (audit C2): the three impersonation exit routes minted an
 * ADMIN session for whatever email a client-set cookie named, with no session
 * check. Oracle: docs/audit-2026-11-08/reproductions.md "C2".
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";

vi.mock("next/headers", async () => (await import("@/test/integration")).nextHeadersMock);
vi.mock("@/lib/prisma", async () => ({ prisma: (await import("@/test/integration")).testPrisma }));
vi.mock("@/lib/email", async () => (await import("@/test/integration")).emailMock);

import {
  db, dbConfigured, jar, req, params, sessionClaims, cleanupFixtures, makeGym, makeOwner,
  makeStudentMember, email, fixtureHash, trackGym,
} from "@/test/integration";
import { createSession } from "@/lib/local-auth";
import { POST as impersonateGym } from "@/app/api/platform/impersonate/[gymId]/route";
import { POST as exitGym } from "@/app/api/platform/impersonate/exit/route";
import { POST as impersonateStudent } from "@/app/api/platform/impersonate-student/[studentId]/route";
import { POST as exitStudent } from "@/app/api/platform/impersonate-student/exit/route";
import { POST as enterDemo } from "@/app/api/platform/demo-mode/enter/route";
import { POST as exitDemo } from "@/app/api/platform/demo-mode/exit/route";

type M = { id: string; gymId: string; clerkUserId: string; email: string; firstName: string; lastName: string };
async function signInMember(m: M, extra: Record<string, unknown> = {}) {
  await createSession({
    userId: m.clerkUserId, email: m.email, name: `${m.firstName} ${m.lastName}`,
    role: "member", gymId: m.gymId, memberId: m.id, userType: "member", ...extra,
  } as Parameters<typeof createSession>[0]);
}

const EXITS = [
  { name: "impersonate/exit", exit: exitGym, cookie: "view_gym_origin" },
  { name: "impersonate-student/exit", exit: exitStudent, cookie: "view_student_origin" },
  { name: "demo-mode/exit", exit: exitDemo, cookie: "demo_mode_origin" },
] as const;

describe.skipIf(!dbConfigured)("C2: impersonation exit restores from a signed claim, never a cookie", () => {
  let owner: M;
  let admin: M;
  let plainMember: M;
  let studentId: string;
  let demoGymExisted = false;

  beforeAll(async () => {
    demoGymExisted = !!(await db().gym.findUnique({ where: { id: "platform-admin-gym" } }));
    if (!demoGymExisted) trackGym("platform-admin-gym");
    const gym = await makeGym();
    owner = await makeOwner(gym.id);
    const sm = await makeStudentMember(gym.id);
    plainMember = sm.member;
    studentId = sm.student.id;
    const staffGym = await makeGym();
    await makeOwner(staffGym.id);
    admin = await db().member.create({
      data: {
        gymId: staffGym.id, clerkUserId: `staff-${Date.now()}`, email: email("staff"), firstName: "Fran",
        lastName: "Staff", passwordHash: await fixtureHash(), isPlatformAdmin: true,
      },
    });
  });
  afterAll(cleanupFixtures);
  beforeEach(() => jar.clear());

  for (const { name, exit, cookie } of EXITS) {
    it(`${name}: a junk session cookie plus an origin cookie mints nothing`, async () => {
      jar.set("matflow-session", "x");
      jar.set(cookie, owner.email);
      const res = await exit();
      expect(res.status).toBe(401);
      expect(sessionClaims()).toBeNull();
    });

    it(`${name}: a real non-impersonating session cannot use an origin cookie to become someone else`, async () => {
      await signInMember(plainMember);
      jar.set(cookie, owner.email);
      const res = await exit();
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(sessionClaims()?.memberId).toBe(plainMember.id);
      expect(sessionClaims()?.role).toBe("member");
    });

    it(`${name}: an impersonatorId that is not a platform admin is refused`, async () => {
      await signInMember(plainMember, { impersonatorId: owner.id });
      const res = await exit();
      expect(res.status).toBe(403);
      expect(sessionClaims()?.memberId).toBe(plainMember.id);
    });
  }

  it("gym impersonation round-trip: start writes impersonatorId into the JWT, exit restores the admin by id", async () => {
    await signInMember(admin);
    const start = await impersonateGym(req(`/api/platform/impersonate/${owner.gymId}`, { method: "POST" }), params({ gymId: owner.gymId }));
    expect(start.status).toBe(200);
    expect(sessionClaims()).toMatchObject({ memberId: owner.id, role: "admin", impersonatorId: admin.id });
    expect(jar.has("view_gym_origin")).toBe(false);

    // A swapped origin cookie must not influence who is restored.
    jar.set("view_gym_origin", plainMember.email);
    const res = await exitGym();
    expect(res.status).toBe(200);
    const claims = sessionClaims();
    expect(claims?.memberId).toBe(admin.id);
    expect(claims?.impersonatorId).toBeUndefined();
    expect(claims?.role).toBe("member"); // re-derived: staff is not their gym's owner
    expect(jar.has("view_gym_origin")).toBe(false);
  });

  it("student impersonation round-trip restores the admin by id", async () => {
    await signInMember(admin);
    const start = await impersonateStudent(req(`/api/platform/impersonate-student/${studentId}`, { method: "POST" }), params({ studentId }));
    expect(start.status).toBe(200);
    expect(sessionClaims()).toMatchObject({ studentId, impersonatorId: admin.id });
    expect(jar.has("view_student_origin")).toBe(false);
    const res = await exitStudent();
    expect(res.status).toBe(200);
    expect(sessionClaims()?.memberId).toBe(admin.id);
    expect(sessionClaims()?.impersonatorId).toBeUndefined();
  });

  it("demo mode round-trip restores the admin by id", async () => {
    await signInMember(admin);
    const start = await enterDemo();
    expect(start.status).toBe(200);
    expect(sessionClaims()).toMatchObject({ gymId: "platform-admin-gym", impersonatorId: admin.id });
    expect(jar.has("demo_mode_origin")).toBe(false);
    const res = await exitDemo();
    expect(res.status).toBe(200);
    expect(sessionClaims()?.memberId).toBe(admin.id);
  });

  it("impersonation cannot be started from inside an impersonated session", async () => {
    await signInMember(admin);
    await impersonateGym(req(`/api/platform/impersonate/${owner.gymId}`, { method: "POST" }), params({ gymId: owner.gymId }));
    const nested = await impersonateStudent(req(`/api/platform/impersonate-student/${studentId}`, { method: "POST" }), params({ studentId }));
    expect(nested.status).toBe(403);
  });
});
