/**
 * Phase 0, item 3 (audit C3): POST /api/auth/join overwrote an existing
 * Student's passwordHash (and reactivated owner-deactivated members) from an
 * unauthenticated request. Oracle: docs/audit-2026-11-08/reproductions.md "C3".
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import bcrypt from "bcryptjs";

vi.mock("next/headers", async () => (await import("@/test/integration")).nextHeadersMock);
vi.mock("@/lib/prisma", async () => ({ prisma: (await import("@/test/integration")).testPrisma }));
vi.mock("@/lib/email", async () => (await import("@/test/integration")).emailMock);

import {
  db, dbConfigured, jar, req, sessionClaims, cleanupFixtures, makeGym, makeOwner, makeStudentMember,
  email, PASSWORD,
} from "@/test/integration";
import { createSession } from "@/lib/local-auth";
import { POST as join } from "@/app/api/auth/join/route";
import { POST as joinSession } from "@/app/api/auth/join-session/route";
import { POST as login } from "@/app/api/auth/login/route";

const HIJACK = "Hijacked-123-long";
const joinBody = (addr: string, gymSlug: string, password = HIJACK) =>
  ({ firstName: "X", lastName: "Y", email: addr, password, gymSlug });

async function passwordStillWorks(addr: string) {
  const s = await db().student.findUnique({ where: { email: addr } });
  return s ? bcrypt.compare(PASSWORD, s.passwordHash) : false;
}

describe.skipIf(!dbConfigured)("C3: the join link never changes an existing identity", () => {
  let gym: { id: string; slug: string };
  let otherGym: { id: string; slug: string };

  beforeAll(async () => {
    gym = await makeGym();
    otherGym = await makeGym();
    await makeOwner(gym.id);
    await makeOwner(otherGym.id);
  });
  afterAll(cleanupFixtures);
  beforeEach(() => jar.clear());

  it("an existing Student with no membership: generic sign-in response, password unchanged", async () => {
    const addr = email("lone");
    await db().student.create({ data: { email: addr, firstName: "L", lastName: "One", passwordHash: await bcrypt.hash(PASSWORD, 4) } });
    const res = await join(req("/api/auth/join", { body: joinBody(addr, gym.slug) }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("SIGN_IN_TO_JOIN");
    expect(sessionClaims()).toBeNull();
    expect(await passwordStillWorks(addr)).toBe(true);
    expect(await db().member.count({ where: { email: addr } })).toBe(0);

    // The reproduction's second half: the hijack password must not log in.
    expect((await login(req("/api/auth/login", { body: { email: addr, password: HIJACK } }))).status).toBe(401);
  });

  it("an existing active member: same generic response and the password is not overwritten first", async () => {
    const { student } = await makeStudentMember(gym.id);
    const res = await join(req("/api/auth/join", { body: joinBody(student.email, gym.slug) }));
    expect(res.status).toBe(409);
    expect(await passwordStillWorks(student.email)).toBe(true);
  });

  it("a member the owner deactivated is not reactivated by the join link", async () => {
    const { student, member } = await makeStudentMember(gym.id, { member: { active: false } });
    const res = await join(req("/api/auth/join", { body: joinBody(student.email, gym.slug) }));
    expect(res.status).toBe(409);
    expect((await db().member.findUnique({ where: { id: member.id } }))?.active).toBe(false);
    expect(await passwordStillWorks(student.email)).toBe(true);
  });

  it("a member the owner deactivated is not reactivated by join-session either", async () => {
    const { student, member } = await makeStudentMember(gym.id, { member: { active: false } });
    await createSession({
      userId: `student-${student.id}`, email: student.email, name: "Sam Student", role: "member",
      gymId: "", memberId: "", userType: "student", studentId: student.id,
    });
    const res = await joinSession(req("/api/auth/join-session", { body: { gymSlug: gym.slug } }));
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect((await db().member.findUnique({ where: { id: member.id } }))?.active).toBe(false);
  });

  it("join-session does not re-approve a membership the owner un-approved", async () => {
    const { student, member } = await makeStudentMember(gym.id, { member: { approved: false } });
    await createSession({
      userId: `student-${student.id}`, email: student.email, name: "Sam Student", role: "member",
      gymId: "", memberId: "", userType: "student", studentId: student.id,
    });
    const res = await joinSession(req("/api/auth/join-session", { body: { gymSlug: gym.slug } }));
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect((await db().member.findUnique({ where: { id: member.id } }))?.approved).toBe(false);
  });

  it("an owner's email (Member only, no Student) creates no Student identity", async () => {
    const owner = await makeOwner(otherGym.id, { email: email("owner2"), clerkUserId: `owner-x-${Date.now()}` });
    const res = await join(req("/api/auth/join", { body: joinBody(owner.email, gym.slug) }));
    expect(res.status).toBe(409);
    expect(await db().student.findUnique({ where: { email: owner.email } })).toBeNull();
    expect(await db().member.count({ where: { email: owner.email } })).toBe(1);
  });

  it("the response is identical whether the email belongs to a student, a member elsewhere, or an owner", async () => {
    const elsewhere = await makeStudentMember(otherGym.id);
    const a = await (await join(req("/api/auth/join", { body: joinBody(elsewhere.student.email, gym.slug) }))).json();
    const owner = await makeOwner(otherGym.id, { email: email("owner3"), clerkUserId: `owner-y-${Date.now()}` });
    const b = await (await join(req("/api/auth/join", { body: joinBody(owner.email, gym.slug) }))).json();
    expect(a).toEqual(b);
    expect(JSON.stringify(a)).not.toContain("P0 Test Gym");
  });

  it("a brand-new email still joins (positive control)", async () => {
    const addr = email("fresh");
    const res = await join(req("/api/auth/join", { body: joinBody(addr, gym.slug) }));
    expect(res.status).toBe(201);
    expect(sessionClaims()).toMatchObject({ email: addr, userType: "student" });
    const m = await db().member.findFirst({ where: { email: addr, gymId: gym.id } });
    expect(m?.active).toBe(true);
  });
});
