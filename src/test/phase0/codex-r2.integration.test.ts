/**
 * Regression tests for Codex adversarial review round 2 (2026-11-08) on the
 * Phase 0 hotfix, against the real local Postgres (real locks, real races):
 *  1. A deactivated (or unapproved) member cannot erase the owner's decision by
 *     leaving and rejoining.
 *  2. One address never gets two unrelated identities: owner registration on a
 *     Student's address is refused, concurrent sign-ups for one address create
 *     exactly one identity, and an existing collision is never resolved by
 *     preferring either side at login.
 *  3. A reset link succeeds exactly once even under concurrent use.
 */
import { describe, it, expect, vi, afterAll, beforeEach } from "vitest";
import bcrypt from "bcryptjs";

vi.mock("next/headers", async () => (await import("@/test/integration")).nextHeadersMock);
vi.mock("@/lib/prisma", async () => ({ prisma: (await import("@/test/integration")).testPrisma }));
vi.mock("@/lib/email", async () => (await import("@/test/integration")).emailMock);

import {
  db, dbConfigured, jar, req, sessionClaims, cleanupFixtures, makeGym, makeOwner, makeStudentMember,
  email, emailMock, PASSWORD,
} from "@/test/integration";
import { createSession, registerGymOwner, registerStudent, DuplicateRegistrationError } from "@/lib/local-auth";
import { POST as leaveGym } from "@/app/api/student/leave-gym/route";
import { POST as joinSession } from "@/app/api/auth/join-session/route";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as forgotPassword } from "@/app/api/auth/forgot-password/route";
import { POST as resetPassword } from "@/app/api/auth/reset-password/route";

async function signInStudent(student: { id: string; email: string }, member?: { id: string; gymId: string }) {
  await createSession({
    userId: `student-${student.id}`, email: student.email, name: "Sam Student", role: "member",
    gymId: member?.gymId ?? "", memberId: member?.id ?? "", userType: "student", studentId: student.id,
  });
}

const ownerInput = (addr: string, slug: string) => ({
  email: addr, password: "Owner-Passw0rd-1", firstName: "New", lastName: "Owner", gymName: `Gym ${slug}`, gymSlug: slug,
});

describe.skipIf(!dbConfigured)("Codex round 2, finding 1: leave-then-rejoin keeps the owner's decision", () => {
  afterAll(cleanupFixtures);
  beforeEach(() => jar.clear());

  for (const state of [{ active: false }, { approved: false }]) {
    it(`a ${state.active === false ? "deactivated" : "unapproved"} member cannot leave and rejoin as active`, async () => {
      const gym = await makeGym();
      await makeOwner(gym.id);
      const { student, member } = await makeStudentMember(gym.id, { member: state });

      // The session issued before the owner's decision is still in hand.
      await signInStudent(student, member);
      const leave = await leaveGym();
      expect(leave.status).toBe(400);
      expect(await db().member.findUnique({ where: { id: member.id } })).not.toBeNull();

      jar.clear();
      await signInStudent(student);
      const rejoin = await joinSession(req("/api/auth/join-session", { body: { gymSlug: gym.slug } }));
      expect(rejoin.status).toBeGreaterThanOrEqual(400);
      const rows = await db().member.findMany({ where: { gymId: gym.id, email: student.email } });
      expect(rows).toHaveLength(1);
      expect(rows[0].active && rows[0].approved).toBe(false);
    });
  }

  it("join-session refuses when another row at the gym already holds the student's address", async () => {
    const gym = await makeGym();
    await makeOwner(gym.id);
    const addr = email("orphan");
    // An inactive row on the same address that is not linked to the student.
    await db().member.create({ data: { gymId: gym.id, clerkUserId: `member-${Date.now()}`, email: addr, firstName: "Old", lastName: "Row", active: false } });
    const student = await db().student.create({ data: { email: addr, firstName: "Re", lastName: "Join", passwordHash: await bcrypt.hash(PASSWORD, 4) } });
    await signInStudent(student);
    const res = await joinSession(req("/api/auth/join-session", { body: { gymSlug: gym.slug } }));
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(await db().member.count({ where: { gymId: gym.id, email: addr } })).toBe(1);
  });

  it("an active member can still leave (positive control)", async () => {
    const gym = await makeGym();
    await makeOwner(gym.id);
    const { student, member } = await makeStudentMember(gym.id);
    await signInStudent(student, member);
    expect((await leaveGym()).status).toBe(200);
    expect(await db().member.findUnique({ where: { id: member.id } })).toBeNull();
  });
});

describe.skipIf(!dbConfigured)("Codex round 2, finding 2: one address, one identity", () => {
  afterAll(cleanupFixtures);
  beforeEach(() => jar.clear());

  it("owner registration on an existing Student's address is refused", async () => {
    const addr = email("solo");
    await db().student.create({ data: { email: addr, firstName: "So", lastName: "Lo", passwordHash: await bcrypt.hash(PASSWORD, 4) } });
    const slug = `p0t-reg-${Date.now()}`;
    await expect(registerGymOwner(ownerInput(addr.toUpperCase(), slug))).rejects.toBeInstanceOf(DuplicateRegistrationError);
    expect(await db().gym.findUnique({ where: { slug } })).toBeNull();
    expect(await db().member.count({ where: { email: { equals: addr, mode: "insensitive" } } })).toBe(0);
  });

  it("concurrent owner registration and student sign-up for one address create exactly one identity", async () => {
    for (let round = 0; round < 5; round++) {
      const addr = email(`race${round}`);
      const slug = `p0t-race-${Date.now()}-${round}`;
      const results = await Promise.allSettled([
        registerGymOwner(ownerInput(addr, slug)),
        registerStudent({ email: addr, password: "Student-Passw0rd", firstName: "Ra", lastName: "Ce" }),
      ]);
      const created = results.filter((r) => r.status === "fulfilled").length;
      const students = await db().student.count({ where: { email: addr } });
      const members = await db().member.count({ where: { email: addr } });
      expect(created).toBe(1);
      expect(students + members).toBe(1);
      await db().gym.deleteMany({ where: { slug } });
    }
  }, 30_000);

  it("an existing collision (owner row + unrelated Student, same password) is refused, not resolved to either side", async () => {
    const gym = await makeGym();
    const owner = await makeOwner(gym.id);
    // Pre-hotfix collision: the student's address was used to register an academy.
    await db().student.create({ data: { email: owner.email, firstName: "Real", lastName: "Student", passwordHash: await bcrypt.hash(PASSWORD, 4) } });
    const res = await login(req("/api/auth/login", { body: { email: owner.email, password: PASSWORD } }));
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("AMBIGUOUS_IDENTITY");
    expect(sessionClaims()).toBeNull();
  });

  it("a student whose Member rows are their own memberships is not ambiguous", async () => {
    const gym = await makeGym();
    await makeOwner(gym.id);
    const { student } = await makeStudentMember(gym.id, { member: { isOwner: false } });
    await db().member.updateMany({ where: { studentId: student.id }, data: { passwordHash: await bcrypt.hash(PASSWORD, 4) } });
    const res = await login(req("/api/auth/login", { body: { email: student.email, password: PASSWORD } }));
    expect(res.status).toBe(200);
    expect(sessionClaims()).toMatchObject({ userType: "student", studentId: student.id });
  });
});

describe.skipIf(!dbConfigured)("Codex round 2, finding 3: a reset link is consumed exactly once", () => {
  afterAll(cleanupFixtures);
  beforeEach(() => {
    jar.clear();
    vi.clearAllMocks();
  });

  it("concurrent uses of one link with different passwords: exactly one succeeds", async () => {
    const gym = await makeGym();
    const owner = await makeOwner(gym.id);
    await forgotPassword(req("/api/auth/forgot-password", { body: { email: owner.email } }));
    const token = new URL(emailMock.sendPasswordReset.mock.calls.at(-1)![2] as string).searchParams.get("token")!;

    const passwords = ["Race-Passw0rd-A1", "Race-Passw0rd-B2", "Race-Passw0rd-C3", "Race-Passw0rd-D4"];
    const statuses = await Promise.all(
      passwords.map(async (pw) => (await resetPassword(req("/api/auth/reset-password", { body: { token, password: pw } }))).status),
    );
    expect(statuses.filter((s) => s === 200)).toHaveLength(1);
    expect(statuses.filter((s) => s === 401)).toHaveLength(passwords.length - 1);

    const winner = passwords[statuses.indexOf(200)];
    const row = await db().member.findUnique({ where: { id: owner.id } });
    expect(await bcrypt.compare(winner, row!.passwordHash!)).toBe(true);
  });

  it("a pre-hotfix single-identity reset link is refused", async () => {
    const { SignJWT } = await import("jose");
    const { JWT_SECRET } = await import("@/lib/jwt-secret");
    const gym = await makeGym();
    const owner = await makeOwner(gym.id);
    const legacy = await new SignJWT({ sub: owner.id, kind: "member", hp: "x", purpose: "password-reset" })
      .setProtectedHeader({ alg: "HS256" }).setExpirationTime("1h").sign(JWT_SECRET);
    const res = await resetPassword(req("/api/auth/reset-password", { body: { token: legacy, password: "Legacy-Passw0rd-1" } }));
    expect(res.status).toBe(401);
  });
});
