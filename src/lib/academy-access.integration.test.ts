/**
 * Packet C — academy-verified rank and student academy access (REAL Postgres).
 *
 * Reproduced pre-fix on 2026-10-24: promoting a linked member blue/0 →
 * purple/1 changed the Member row while the promotion notification opened
 * /student/profile, which shows the unchanged personal rank (blue/0); and
 * "Open Gym" redirected (307) back to /student instead of an academy page.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { randomUUID } from "crypto";

const mocks = vi.hoisted(() => ({
  owner: { gymId: "" },
  session: null as null | Record<string, unknown>,
  notify: vi.fn(async () => {}),
  createSession: vi.fn(async () => {}),
}));

vi.mock("@/lib/prisma", async () => ({
  prisma: (await import("@/lib/test-integration-prisma")).integrationPrisma(),
}));
vi.mock("@/lib/owner-access", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/owner-access")>()),
  requireOwnerAccess: async () => mocks.owner,
}));
vi.mock("@/lib/local-auth", () => ({ getSession: async () => mocks.session, createSession: mocks.createSession }));
vi.mock("@/lib/push", () => ({ notify: mocks.notify }));
vi.mock("@/lib/email", () => ({ sendBeltPromotion: () => {} }));
vi.mock("@/lib/activity-log", () => ({ logActivity: () => {} }));

import { integrationDb, integrationPrisma } from "./test-integration-prisma";
import { studentMemberships, resolveStudentMembershipForGym } from "./student-membership";
import { POST as promote } from "@/app/api/admin/members/[id]/promote/route";
import { POST as switchGym } from "@/app/api/student/switch-gym/[gymId]/route";

const db = integrationDb();
const prisma = integrationPrisma();
const RUN = `pc${randomUUID().slice(0, 8)}`;
const gymIds: string[] = [];
const studentIds: string[] = [];

async function gym(label: string) {
  const g = await prisma.gym.create({ data: { clerkOrgId: `${RUN}-${label}`, name: `${RUN} ${label}`, slug: `${RUN}-${label}`, approved: true } });
  gymIds.push(g.id);
  return g;
}

describe.skipIf(!db)("Packet C — academy rank and access (real Postgres)", () => {
  let alpha: { id: string };
  let bravo: { id: string };
  let student: { id: string; email: string };
  let mAlpha: { id: string };
  let mBravo: { id: string };

  beforeAll(async () => {
    await prisma.$queryRaw`SELECT 1`;
    alpha = await gym("alpha");
    bravo = await gym("bravo");
    student = await prisma.student.create({
      data: { email: `${RUN}@test.local`, firstName: "Dana", lastName: "Synthetic", passwordHash: "x", beltRank: "blue", stripes: 0 },
    });
    studentIds.push(student.id);
    mAlpha = await prisma.member.create({
      data: { gymId: alpha.id, clerkUserId: `${RUN}-a`, email: student.email, firstName: "Dana", lastName: "S", studentId: student.id, beltRank: "blue", stripes: 0 },
    });
    mBravo = await prisma.member.create({
      data: { gymId: bravo.id, clerkUserId: `${RUN}-b`, email: student.email, firstName: "Dana", lastName: "S", studentId: student.id, beltRank: "white", stripes: 3 },
    });
  });

  afterAll(async () => {
    await prisma.gym.deleteMany({ where: { id: { in: gymIds } } });
    await prisma.student.deleteMany({ where: { id: { in: studentIds } } });
    await prisma.$disconnect();
  });

  it("C1/C2: promotion updates only that academy's verified rank + history; personal and other-academy ranks unchanged", async () => {
    mocks.owner = { gymId: alpha.id };
    const res = await promote(
      new Request("http://x", { method: "POST", body: JSON.stringify({ beltRank: "purple", stripes: 1 }) }) as never,
      { params: Promise.resolve({ id: mAlpha.id }) },
    );
    expect(res.status).toBe(201);

    const memberships = await studentMemberships(student.id);
    const byGym = Object.fromEntries(memberships.map((m) => [m.gymId, `${m.beltRank}/${m.stripes}`]));
    expect(byGym[alpha.id]).toBe("purple/1");
    expect(byGym[bravo.id]).toBe("white/3");
    const personal = await prisma.student.findUniqueOrThrow({ where: { id: student.id } });
    expect(`${personal.beltRank}/${personal.stripes}`).toBe("blue/0");
    const history = await prisma.beltProgress.findMany({ where: { memberId: mAlpha.id } });
    expect(history.map((h) => `${h.gymId}:${h.beltRank}/${h.stripes}`)).toEqual([`${alpha.id}:purple/1`]);
    expect(await prisma.beltProgress.count({ where: { memberId: mBravo.id } })).toBe(0);

    // The notification opens the academy view that shows the verified rank.
    const call = (mocks.notify.mock.calls[0] as unknown as [{ url: string }])[0];
    expect(call.url).toBe(`/student/academy?gym=${encodeURIComponent(alpha.id)}#progress`);
  });

  it("C1: an owner cannot promote another academy's member", async () => {
    mocks.owner = { gymId: bravo.id };
    const res = await promote(
      new Request("http://x", { method: "POST", body: JSON.stringify({ beltRank: "black", stripes: 0 }) }) as never,
      { params: Promise.resolve({ id: mAlpha.id }) },
    );
    expect(res.status).toBe(404);
    expect((await prisma.member.findUniqueOrThrow({ where: { id: mAlpha.id } })).beltRank).toBe("purple");
  });

  it("C3: Open academy (switch-gym) answers 303 to that academy's page", async () => {
    mocks.session = { studentId: student.id, userId: "u", email: student.email, gymId: alpha.id, memberId: mAlpha.id, userType: "student" };
    mocks.createSession.mockClear();
    const res = await switchGym(new Request("http://localhost/api/student/switch-gym/x", { method: "POST" }) as never, {
      params: Promise.resolve({ gymId: bravo.id }),
    });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`http://localhost/student/academy?gym=${bravo.id}`);
    expect(mocks.createSession).toHaveBeenCalledWith(expect.objectContaining({ gymId: bravo.id, memberId: mBravo.id }));
  });

  it("C6: a revoked membership cannot be opened or resolved, and is not listed", async () => {
    await prisma.member.update({ where: { id: mBravo.id }, data: { active: false } });
    mocks.createSession.mockClear();
    const res = await switchGym(new Request("http://localhost/api/student/switch-gym/x", { method: "POST" }) as never, {
      params: Promise.resolve({ gymId: bravo.id }),
    });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("http://localhost/student/academy");
    expect(mocks.createSession).not.toHaveBeenCalled();
    expect(await resolveStudentMembershipForGym(student.id, bravo.id)).toBeNull();
    expect((await studentMemberships(student.id)).map((m) => m.gymId)).toEqual([alpha.id]);

    // A gym the student never belonged to.
    const stranger = await gym("stranger");
    expect(await resolveStudentMembershipForGym(student.id, stranger.id)).toBeNull();
    await prisma.member.update({ where: { id: mBravo.id }, data: { active: true } });
  });
});
