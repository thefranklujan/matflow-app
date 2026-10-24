/**
 * Packet D — class commitments and reminder semantics (REAL Postgres, time
 * injected, push mocked).
 *
 * Reproduced pre-fix on 2026-10-24: a commitment exactly as the schedule UI
 * writes it ("BJJ@18:00", browser-local midnight) produced ZERO reminders
 * because the cron matched raw classType; the old 36h date window could also
 * attribute the next day's commitments to today's class.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import { randomUUID } from "crypto";

const mocks = vi.hoisted(() => ({
  pushes: [] as Array<{ externalIds: string[]; url?: string }>,
  session: null as null | { studentId: string; email: string },
}));

vi.mock("@/lib/prisma", async () => ({
  prisma: (await import("@/lib/test-integration-prisma")).integrationPrisma(),
}));
vi.mock("@/lib/push", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/push")>()),
  sendBulkPush: async (o: { externalIds: string[]; url?: string }) => {
    mocks.pushes.push(o);
  },
}));
vi.mock("@/lib/local-auth", () => ({ getSession: async () => mocks.session }));

import { integrationDb, integrationPrisma } from "./test-integration-prisma";
import { runClassReminders, reminderUrl } from "./class-reminders";
import { commitmentKey } from "./class-commitment";
import * as studentCommit from "@/app/api/student/academy/[gymId]/commitments/route";

const db = integrationDb();
const prisma = integrationPrisma();
const RUN = `pd${randomUUID().slice(0, 8)}`;
const gymIds: string[] = [];
const studentIds: string[] = [];

async function gym(label: string, timezone = "America/Chicago") {
  const g = await prisma.gym.create({
    data: { clerkOrgId: `${RUN}-${label}`, name: `${RUN} ${label}`, slug: `${RUN}-${label}`, timezone, approved: true },
  });
  gymIds.push(g.id);
  return g;
}
async function member(gymId: string, label: string, extra: { active?: boolean } = {}) {
  const s = await prisma.student.create({
    data: { email: `${RUN}-${label}@test.local`, firstName: label, lastName: "S", passwordHash: "x" },
  });
  studentIds.push(s.id);
  const m = await prisma.member.create({
    data: { gymId, clerkUserId: `${RUN}-${label}`, email: `${RUN}-${label}@test.local`, firstName: label, lastName: "S", studentId: s.id, ...extra },
  });
  return { student: s, member: m };
}
function cls(gymId: string, dayOfWeek: number, startTime: string, classType = "BJJ", endTime?: string, locationSlug = "main") {
  return prisma.classSchedule.create({
    data: { gymId, dayOfWeek, startTime, endTime: endTime ?? "23:59", classType, instructor: "Coach", locationSlug },
  });
}
function commit(gymId: string, memberId: string, classDate: string, classType: string, locationSlug = "main") {
  return prisma.scheduleCommitment.create({
    data: { gymId, memberId, classDate: new Date(classDate), classType, locationSlug },
  });
}
function pushedTo(studentId: string) {
  return mocks.pushes.filter((p) => p.externalIds.includes(`student-${studentId}`));
}
async function inbox(gymId: string) {
  return prisma.notification.findMany({ where: { gymId, kind: "class_reminder" } });
}

describe.skipIf(!db)("Packet D — reminders (real Postgres)", () => {
  beforeAll(async () => {
    await prisma.$queryRaw`SELECT 1`;
  });
  beforeEach(() => {
    mocks.pushes = [];
  });
  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { gymId: { in: gymIds } } });
    await prisma.gym.deleteMany({ where: { id: { in: gymIds } } });
    await prisma.student.deleteMany({ where: { id: { in: studentIds } } });
    await prisma.$disconnect();
  });

  // Monday 2026-10-26, America/Chicago is CDT (UTC-5). 22:44Z = 17:44 local.
  const MON_1744 = new Date("2026-10-26T22:44:00Z");

  it("D1/D2/D3: two same-type classes on one day stay separate; only the committed occurrence's members are reminded", async () => {
    const g = await gym("d1");
    const six = await cls(g.id, 1, "18:00");
    const sevenThirty = await cls(g.id, 1, "19:30");
    const a = await member(g.id, "early");
    const b = await member(g.id, "late");
    const nonmemberGym = await gym("d1other");
    const other = await member(nonmemberGym.id, "otherTenant");
    await cls(nonmemberGym.id, 1, "19:00", "Judo");

    await commit(g.id, a.member.id, "2026-10-26T00:00:00Z", commitmentKey("BJJ", "18:00"));
    // Legacy browser-local-midnight encoding of the same date also resolves.
    await commit(g.id, b.member.id, "2026-10-26T05:00:00Z", commitmentKey("BJJ", "19:30"));
    // Tomorrow's commitment for the 18:00 slot must NOT be reminded today.
    await prisma.scheduleCommitment.create({
      data: { gymId: g.id, memberId: b.member.id, classDate: new Date("2026-10-27T00:00:00Z"), classType: commitmentKey("BJJ", "18:00"), locationSlug: "main" },
    });

    await runClassReminders(MON_1744);
    expect(pushedTo(a.student.id)).toHaveLength(1);
    expect(pushedTo(a.student.id)[0].url).toContain(encodeURIComponent(six.id));
    expect(pushedTo(b.student.id)).toHaveLength(0);
    expect(pushedTo(other.student.id)).toHaveLength(0);

    // 19:30 class becomes due at 19:14 local.
    mocks.pushes = [];
    await runClassReminders(new Date("2026-10-27T00:14:00Z"));
    expect(pushedTo(b.student.id)).toHaveLength(1);
    expect(pushedTo(b.student.id)[0].url).toContain(encodeURIComponent(sevenThirty.id));
    expect(pushedTo(a.student.id)).toHaveLength(0);
  });

  it("D2: a legacy raw-type commitment is attributed only when exactly one class matches; ambiguity is excluded and counted", async () => {
    const g = await gym("d2");
    await cls(g.id, 1, "18:00");
    await cls(g.id, 1, "18:00", "Kids", "18:45");
    await cls(g.id, 1, "20:00");
    const amb = await member(g.id, "ambiguous");
    const uniq = await member(g.id, "unique");
    await commit(g.id, amb.member.id, "2026-10-26T05:00:00Z", "BJJ");
    await commit(g.id, uniq.member.id, "2026-10-26T05:00:00Z", "Kids");

    const r = await runClassReminders(MON_1744);
    expect(pushedTo(amb.student.id)).toHaveLength(0);
    expect(pushedTo(uniq.student.id)).toHaveLength(1);
    expect(r.ambiguousLegacy).toBeGreaterThanOrEqual(1);
  });

  it("D4: repeated and concurrent cron runs create one inbox row and one push attempt per student per occurrence", async () => {
    const g = await gym("d4");
    const c = await cls(g.id, 1, "18:00");
    const a = await member(g.id, "dedupe");
    await commit(g.id, a.member.id, "2026-10-26T00:00:00Z", commitmentKey("BJJ", "18:00"));

    await Promise.all([runClassReminders(MON_1744), runClassReminders(MON_1744), runClassReminders(MON_1744)]);
    await runClassReminders(new Date("2026-10-26T22:46:00Z")); // retry inside the window
    expect(pushedTo(a.student.id)).toHaveLength(1);
    const rows = await inbox(g.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].url).toBe(reminderUrl(g.id, c.id, "2026-10-26"));
  });

  it("D5: canceled class, rescheduled time and revoked membership produce no reminder", async () => {
    const g = await gym("d5");
    const canceled = await cls(g.id, 1, "18:00", "Gi");
    await prisma.classSchedule.update({ where: { id: canceled.id }, data: { active: false } });
    const moved = await cls(g.id, 1, "18:00", "NoGi");
    const revokedClass = await cls(g.id, 1, "18:00", "Drills");
    const x = await member(g.id, "canceled");
    const y = await member(g.id, "moved");
    const z = await member(g.id, "revoked", { active: false });
    await commit(g.id, x.member.id, "2026-10-26T00:00:00Z", commitmentKey("Gi", "18:00"));
    await commit(g.id, y.member.id, "2026-10-26T00:00:00Z", commitmentKey("NoGi", "17:00")); // committed before reschedule to 18:00
    await commit(g.id, z.member.id, "2026-10-26T00:00:00Z", commitmentKey(revokedClass.classType, "18:00"));
    void moved;

    await runClassReminders(MON_1744);
    expect(pushedTo(x.student.id)).toHaveLength(0);
    expect(pushedTo(y.student.id)).toHaveLength(0);
    expect(pushedTo(z.student.id)).toHaveLength(0);
    expect(await inbox(g.id)).toHaveLength(0);
  });

  it("D6: DST end (Nov 1, 2026) and a just-after-midnight class use the academy's local clock", async () => {
    const g = await gym("d6");
    await cls(g.id, 0, "09:00"); // Sunday
    await cls(g.id, 1, "00:10", "Late"); // Monday 00:10
    const dst = await member(g.id, "dst");
    const late = await member(g.id, "midnight");
    await commit(g.id, dst.member.id, "2026-11-01T00:00:00Z", commitmentKey("BJJ", "09:00"));
    await commit(g.id, late.member.id, "2026-11-02T00:00:00Z", commitmentKey("Late", "00:10"));

    // After the fall-back, Chicago is CST (UTC-6): 14:44Z = 08:44 local.
    // A fixed UTC-5 assumption would compute 09:44 and miss the window.
    await runClassReminders(new Date("2026-11-01T14:44:00Z"));
    expect(pushedTo(dst.student.id)).toHaveLength(1);

    // Sunday 23:53 CST (05:53Z Monday) → the Monday 00:10 class is 17 min away.
    await runClassReminders(new Date("2026-11-02T05:53:00Z"));
    expect(pushedTo(late.student.id)).toHaveLength(1);
    const row = (await inbox(g.id)).find((n) => n.externalId === `student-${late.student.id}`);
    expect(row?.url).toContain("date=2026-11-02");
  });

  it("D1/D7: student commit API stores the canonical occurrence, rejects other tenants and past classes, never records attendance", async () => {
    const g = await gym("d7");
    const otherGym = await gym("d7other");
    const c = await cls(g.id, 1, "18:00");
    const foreign = await cls(otherGym.id, 1, "18:00");
    const s = await member(g.id, "committer");
    mocks.session = { studentId: s.student.id, email: s.student.email };

    // Next Monday from real "now", as the academy page would offer it.
    const now = new Date();
    const local = new Date(now.toLocaleString("en-US", { timeZone: "America/Chicago" }));
    const daysAhead = ((1 - local.getDay() + 7) % 7) || 7;
    const target = new Date(Date.UTC(local.getFullYear(), local.getMonth(), local.getDate() + daysAhead));
    const dateKey = target.toISOString().slice(0, 10);
    const req = (body: unknown, method = "POST") =>
      new Request("http://x", { method, body: JSON.stringify(body) }) as unknown as import("next/server").NextRequest;
    const p = (gymId: string) => ({ params: Promise.resolve({ gymId }) });

    expect((await studentCommit.POST(req({ scheduleId: c.id, date: dateKey }), p(g.id))).status).toBe(201);
    expect((await studentCommit.POST(req({ scheduleId: c.id, date: dateKey }), p(g.id))).status).toBe(201); // idempotent
    const rows = await prisma.scheduleCommitment.findMany({ where: { memberId: s.member.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.classType).toBe("BJJ@18:00");
    expect(rows[0]!.classDate.toISOString()).toBe(`${dateKey}T00:00:00.000Z`);

    expect((await studentCommit.POST(req({ scheduleId: foreign.id, date: dateKey }), p(g.id))).status).toBe(400);
    expect((await studentCommit.POST(req({ scheduleId: foreign.id, date: dateKey }), p(otherGym.id))).status).toBe(403);
    expect((await studentCommit.POST(req({ scheduleId: c.id, date: "2020-01-06" }), p(g.id))).status).toBe(400);
    expect(await prisma.attendance.count({ where: { memberId: s.member.id } })).toBe(0);

    expect((await studentCommit.DELETE(req({ scheduleId: c.id, date: dateKey }, "DELETE"), p(g.id))).status).toBe(200);
    expect(await prisma.scheduleCommitment.count({ where: { memberId: s.member.id } })).toBe(0);
  });
});
