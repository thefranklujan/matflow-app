/**
 * Regression tests for Codex adversarial review round 1 (2026-11-08) on the
 * Phase 0 hotfix:
 *  1. Ownership never transfers by row order; the owner cannot leave or
 *     delete their academy membership through student routes.
 *  3. Password recovery resets every identity with the address, and login
 *     prefers the privileged identity, so a shadow Student cannot capture it.
 *  4. Students keep a waiver-signing path after /members was removed.
 * (Finding 2, shared rate limiting, is a Vercel Firewall release step.)
 */
import { describe, it, expect, vi, afterAll, beforeEach } from "vitest";
import bcrypt from "bcryptjs";

vi.mock("next/headers", async () => (await import("@/test/integration")).nextHeadersMock);
vi.mock("@/lib/prisma", async () => ({ prisma: (await import("@/test/integration")).testPrisma }));
vi.mock("@/lib/email", async () => (await import("@/test/integration")).emailMock);
const pushes = vi.hoisted(() => ({ notify: vi.fn(async () => {}) }));
vi.mock("@/lib/push", () => pushes);

import {
  db, dbConfigured, jar, req, sessionClaims, cleanupFixtures, makeGym, makeOwner, makeStudentMember,
  email, fixtureHash, emailMock, PASSWORD,
} from "@/test/integration";
import { NextRequest } from "next/server";
import { createSession } from "@/lib/local-auth";
import { middleware } from "@/middleware";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as leaveGym } from "@/app/api/student/leave-gym/route";
import { POST as accountDelete } from "@/app/api/auth/account-delete/route";
import { POST as forgotPassword } from "@/app/api/auth/forgot-password/route";
import { POST as resetPassword } from "@/app/api/auth/reset-password/route";
import { POST as publishWaiver } from "@/app/api/admin/waivers/route";
import { GET as getWaiver, POST as signWaiver } from "@/app/api/members/waiver/route";
import StudentWaiverPage from "@/app/student/(portal)/waiver/page";
import WaiverSignForm from "@/components/WaiverSignForm";

type M = { id: string; gymId: string; clerkUserId: string; email: string; firstName: string; lastName: string };
async function signIn(m: M, role: "admin" | "member") {
  await createSession({
    userId: m.clerkUserId, email: m.email, name: `${m.firstName} ${m.lastName}`,
    role, gymId: m.gymId, memberId: m.id, userType: "member",
  });
}

describe.skipIf(!dbConfigured)("Codex round 1, finding 1: ownership never follows row order", () => {
  afterAll(cleanupFixtures);
  beforeEach(() => jar.clear());

  it("a legacy gym with no marker and no flag has no admin (fail closed)", async () => {
    const gym = await makeGym();
    const legacy = await db().member.create({
      data: { gymId: gym.id, clerkUserId: `local-admin-${Date.now()}`, email: email("legacy"), firstName: "Leg", lastName: "Acy", passwordHash: await fixtureHash(), createdAt: new Date("2020-01-01T00:00:00Z") },
    });
    await login(req("/api/auth/login", { body: { email: legacy.email, password: PASSWORD } }));
    expect(sessionClaims()).toMatchObject({ memberId: legacy.id, role: "member" });
  });

  it("an isOwner row is the owner even when it is not the oldest", async () => {
    const gym = await makeGym();
    await db().member.create({
      data: { gymId: gym.id, clerkUserId: `local-member-${Date.now()}`, email: email("older"), firstName: "Old", lastName: "Er", passwordHash: await fixtureHash(), createdAt: new Date("2020-01-01T00:00:00Z") },
    });
    const flaggedOwner = await db().member.create({
      data: { gymId: gym.id, clerkUserId: `local-admin-${Date.now()}`, email: email("legacyowner"), firstName: "Own", lastName: "Er", passwordHash: await fixtureHash(), isOwner: true },
    });
    await login(req("/api/auth/login", { body: { email: flaggedOwner.email, password: PASSWORD } }));
    expect(sessionClaims()).toMatchObject({ memberId: flaggedOwner.id, role: "admin" });
  });

  it("the owner cannot leave their academy through /api/student/leave-gym", async () => {
    const gym = await makeGym();
    const owner = await makeOwner(gym.id);
    await signIn(owner, "admin");
    const res = await leaveGym();
    expect(res.status).toBe(400);
    expect(await db().member.findUnique({ where: { id: owner.id } })).not.toBeNull();
  });

  it("account-delete refuses a student identity linked to an owner row", async () => {
    const gym = await makeGym();
    const { student, member } = await makeStudentMember(gym.id, { member: { isOwner: true } });
    await createSession({
      userId: `student-${student.id}`, email: student.email, name: "Sam Student", role: "member",
      gymId: gym.id, memberId: member.id, userType: "student", studentId: student.id,
    });
    const res = await accountDelete(req("/api/auth/account-delete", { body: { confirmation: "DELETE" } }));
    expect(res.status).toBe(400);
    expect(await db().member.findUnique({ where: { id: member.id } })).not.toBeNull();
  });
});

describe.skipIf(!dbConfigured)("Codex round 1, finding 3: recovery and login agree", () => {
  afterAll(cleanupFixtures);
  beforeEach(() => {
    jar.clear();
    vi.clearAllMocks();
  });

  async function resetVia(addr: string, newPassword: string) {
    expect((await forgotPassword(req("/api/auth/forgot-password", { body: { email: addr } }))).status).toBe(200);
    const call = emailMock.sendPasswordReset.mock.calls.at(-1);
    expect(call).toBeTruthy();
    const token = new URL(call![2] as string).searchParams.get("token")!;
    return resetPassword(req("/api/auth/reset-password", { body: { token, password: newPassword } }));
  }

  it("a shadow Student on an owner's address cannot capture the reset or the login", async () => {
    const gym = await makeGym();
    const owner = await makeOwner(gym.id);
    // C1-era shadow: a Student registered with the owner's address and an attacker password.
    await db().student.create({ data: { email: owner.email, firstName: "Sha", lastName: "Dow", passwordHash: await bcrypt.hash("attacker-password", 4) } });

    const res = await resetVia(owner.email, "Owner-New-Passw0rd");
    expect(res.status).toBe(200);

    const ownerRow = await db().member.findUnique({ where: { id: owner.id } });
    expect(await bcrypt.compare("Owner-New-Passw0rd", ownerRow!.passwordHash!)).toBe(true);
    const shadow = await db().student.findUnique({ where: { email: owner.email } });
    expect(await bcrypt.compare("attacker-password", shadow!.passwordHash)).toBe(false);

    await login(req("/api/auth/login", { body: { email: owner.email, password: "Owner-New-Passw0rd" } }));
    expect(sessionClaims()).toMatchObject({ memberId: owner.id, role: "admin", userType: "member" });
  });

  it("a password-less Member row does not suppress recovery for the owner row", async () => {
    const gymA = await makeGym();
    const gymB = await makeGym();
    const addr = email("multi");
    await db().member.create({ data: { gymId: gymA.id, clerkUserId: `dropin-${Date.now()}`, email: addr, firstName: "No", lastName: "Pass", createdAt: new Date("2019-01-01T00:00:00Z") } });
    const owner = await makeOwner(gymB.id, { email: addr });
    const res = await resetVia(addr, "Another-Passw0rd-1");
    expect(res.status).toBe(200);
    expect(await bcrypt.compare("Another-Passw0rd-1", (await db().member.findUnique({ where: { id: owner.id } }))!.passwordHash!)).toBe(true);
  });

  it("a reset link is single-use", async () => {
    const gym = await makeGym();
    const owner = await makeOwner(gym.id);
    await forgotPassword(req("/api/auth/forgot-password", { body: { email: owner.email } }));
    const token = new URL(emailMock.sendPasswordReset.mock.calls.at(-1)![2] as string).searchParams.get("token")!;
    expect((await resetPassword(req("/api/auth/reset-password", { body: { token, password: "First-Passw0rd-1" } }))).status).toBe(200);
    expect((await resetPassword(req("/api/auth/reset-password", { body: { token, password: "Second-Passw0rd-1" } }))).status).toBe(401);
  });

  it("a normal joined student still signs in as a student", async () => {
    const gym = await makeGym();
    const { student } = await makeStudentMember(gym.id, { member: { passwordHash: await fixtureHash() } });
    await login(req("/api/auth/login", { body: { email: student.email, password: PASSWORD } }));
    expect(sessionClaims()).toMatchObject({ userType: "student", studentId: student.id });
  });
});

describe.skipIf(!dbConfigured)("Codex round 1, finding 4: students can still sign waivers", () => {
  afterAll(cleanupFixtures);
  beforeEach(() => jar.clear());

  it("publish -> notification to /student/waiver -> student signs in the student portal", async () => {
    const gym = await makeGym();
    const owner = await makeOwner(gym.id);
    const { student, member } = await makeStudentMember(gym.id);

    await signIn(owner, "admin");
    const pub = await publishWaiver(req("/api/admin/waivers", { body: { title: "Liability", content: "Train safe." } }));
    expect(pub.status).toBe(201);
    expect(pushes.notify).toHaveBeenCalledWith(expect.objectContaining({ kind: "waiver_required", url: "/student/waiver" }));

    jar.clear();
    await createSession({
      userId: `student-${student.id}`, email: student.email, name: "Sam Student", role: "member",
      gymId: gym.id, memberId: member.id, userType: "student", studentId: student.id,
    });
    const before = await (await getWaiver()).json();
    expect(before).toMatchObject({ template: { title: "Liability" }, signed: false });
    const sign = await signWaiver(req("/api/members/waiver", { body: { templateId: before.template.id, signedName: "Sam Student" } }));
    expect(sign.status).toBe(201);
    expect((await (await getWaiver()).json()).signed).toBe(true);

    // The student portal page renders the signing form, and old links land on it.
    expect(StudentWaiverPage().type).toBe(WaiverSignForm);
    const res = middleware(new NextRequest("http://localhost/members/waiver", { headers: { cookie: "matflow-session=x" } }));
    expect(new URL(res.headers.get("location")!).pathname).toBe("/student/waiver");
  });
});
