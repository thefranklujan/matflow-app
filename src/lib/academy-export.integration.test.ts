/**
 * Packet F — owner-scoped academy export (REAL Postgres, two tenants).
 */
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { randomUUID } from "crypto";

const mocks = vi.hoisted(() => ({
  owner: null as null | { gymId: string; memberId: string; userId: string },
  lockedOut: false,
  session: null as null | { email: string },
  logged: [] as unknown[],
}));

vi.mock("@/lib/prisma", async () => ({
  prisma: (await import("@/lib/test-integration-prisma")).integrationPrisma(),
}));
vi.mock("@/lib/owner-access", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/owner-access")>();
  const { deriveEntitlement } = await import("@/lib/entitlements");
  return {
    ...actual,
    requireOwnerAccess: async () => {
      if (!mocks.owner) throw new Error("Unauthorized");
      if (mocks.lockedOut) {
        throw new actual.EntitlementError(
          "SUBSCRIPTION_REQUIRED",
          deriveEntitlement({ subscriptionStatus: "canceled", trialEndsAt: null, stripePriceId: null, approved: true }),
        );
      }
      return mocks.owner;
    },
  };
});
vi.mock("@/lib/local-auth", () => ({ getSession: async () => mocks.session }));
vi.mock("@/lib/activity-log", () => ({ logActivity: (e: unknown) => mocks.logged.push(e) }));

import { integrationDb, integrationPrisma } from "./test-integration-prisma";
import { GET as ownerExport } from "@/app/api/admin/export/route";
import { GET as supportExport } from "@/app/api/platform/gyms/[gymId]/export/route";

const db = integrationDb();
const prisma = integrationPrisma();
const RUN = `pf${randomUUID().slice(0, 8)}`;
const gymIds: string[] = [];
const studentIds: string[] = [];
const SECRET_JOURNAL = `${RUN}-private-journal-entry`;
const SECRET_CODE = `${RUN}-kiosk-code`;

async function tenant(label: string) {
  const gym = await prisma.gym.create({
    data: { clerkOrgId: `${RUN}-${label}`, name: `${RUN} ${label} Academy`, slug: `${RUN}-${label}`, approved: true, stripeCustomerId: `cus_${RUN}${label}` },
  });
  gymIds.push(gym.id);
  const student = await prisma.student.create({
    data: { email: `${RUN}-${label}-s@test.local`, firstName: "Stu", lastName: label, passwordHash: `${RUN}-student-hash` },
  });
  studentIds.push(student.id);
  await prisma.trainingSession.create({ data: { studentId: student.id, date: new Date(), sessionType: "gi", notes: SECRET_JOURNAL } });
  const owner = await prisma.member.create({
    data: { gymId: gym.id, clerkUserId: `${RUN}-${label}-clerk`, email: `${RUN}-${label}-o@test.local`, firstName: "Owner", lastName: label, passwordHash: `${RUN}-owner-hash`, beltRank: "black" },
  });
  const m = await prisma.member.create({
    data: { gymId: gym.id, clerkUserId: `${RUN}-${label}-m`, email: student.email, firstName: "Stu", lastName: label, studentId: student.id, checkinCode: SECRET_CODE },
  });
  const inst = await prisma.instructor.create({ data: { gymId: gym.id, name: `Coach ${label}`, memberId: owner.id } });
  await prisma.classSchedule.create({ data: { gymId: gym.id, dayOfWeek: 2, startTime: "18:00", endTime: "19:00", classType: "BJJ", instructor: "Coach", instructorId: inst.id, locationSlug: "main" } });
  await prisma.attendance.createMany({
    data: [
      { gymId: gym.id, memberId: m.id, classDate: new Date("2026-10-20T00:00:00Z"), classType: "BJJ", locationSlug: "main" },
      { gymId: gym.id, memberId: m.id, classDate: new Date("2026-10-21T00:00:00Z"), classType: "BJJ", locationSlug: "main" },
    ],
  });
  await prisma.beltProgress.create({ data: { gymId: gym.id, memberId: m.id, beltRank: "blue", stripes: 1 } });
  const t = await prisma.waiverTemplate.create({ data: { gymId: gym.id, title: "W", content: "current v2", version: 2 } });
  await prisma.waiverSignature.create({ data: { gymId: gym.id, memberId: m.id, templateId: t.id, version: 1, signedName: "Stu", waiverContentSnapshot: "signed v1 text" } });
  const drop = await prisma.dropIn.create({ data: { gymId: gym.id, firstName: "Drop", lastName: label } });
  await prisma.waiverSignature.create({ data: { gymId: gym.id, dropInId: drop.id, templateId: t.id, version: 2, signedName: "Drop", waiverContentSnapshot: "current v2" } });
  return { gym, owner, member: m };
}

async function fingerprint(gymId: string) {
  const [members, attendance, belts, sigs, templates] = await Promise.all([
    prisma.member.findMany({ where: { gymId }, orderBy: { id: "asc" } }),
    prisma.attendance.findMany({ where: { gymId }, orderBy: { id: "asc" } }),
    prisma.beltProgress.findMany({ where: { gymId }, orderBy: { id: "asc" } }),
    prisma.waiverSignature.findMany({ where: { gymId }, orderBy: { id: "asc" } }),
    prisma.waiverTemplate.findMany({ where: { gymId }, orderBy: { id: "asc" } }),
  ]);
  return JSON.stringify({ members, attendance, belts, sigs, templates });
}

describe.skipIf(!db)("Packet F — academy export (real Postgres)", () => {
  let a: Awaited<ReturnType<typeof tenant>>;
  let b: Awaited<ReturnType<typeof tenant>>;

  beforeAll(async () => {
    await prisma.$queryRaw`SELECT 1`;
    process.env.PLATFORM_ADMIN_EMAILS = "founder@e2e.matflow.test";
    a = await tenant("alpha");
    b = await tenant("bravo");
  });
  afterAll(async () => {
    await prisma.gym.deleteMany({ where: { id: { in: gymIds } } });
    await prisma.student.deleteMany({ where: { id: { in: studentIds } } });
    await prisma.$disconnect();
  });

  it("F1/F2/F4: own-tenant records with reconciling manifest; no other tenant, journals or credentials; no mutation", async () => {
    mocks.owner = { gymId: a.gym.id, memberId: a.owner.id, userId: "u" };
    mocks.lockedOut = false;
    const before = await fingerprint(a.gym.id);

    const res = await ownerExport();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(res.headers.get("content-disposition")).toContain("attachment;");
    const text = await res.text();
    const data = JSON.parse(text);

    expect(data.format).toBe("matflow-academy-export");
    expect(data.schemaVersion).toBe(1);
    expect(data.academy.id).toBe(a.gym.id);
    expect(data.manifest.counts).toEqual({
      members: 2, instructors: 1, classSchedules: 1, attendance: 2, beltProgress: 1,
      waiverTemplates: 1, waiverSignatures: 2, dropIns: 1,
    });
    for (const [k, n] of Object.entries(data.manifest.counts)) expect(data[k]).toHaveLength(n as number);

    // Relationships reconcile.
    const memberIds = new Set(data.members.map((m: { id: string }) => m.id));
    for (const r of [...data.attendance, ...data.beltProgress]) expect(memberIds.has(r.memberId)).toBe(true);
    const templateIds = new Set(data.waiverTemplates.map((t: { id: string }) => t.id));
    const dropIds = new Set(data.dropIns.map((d: { id: string }) => d.id));
    for (const s of data.waiverSignatures) {
      expect(templateIds.has(s.templateId)).toBe(true);
      expect(s.memberId ? memberIds.has(s.memberId) : dropIds.has(s.dropInId)).toBe(true);
    }
    // The signed snapshot (v1) is preserved separately from the current text (v2).
    expect(data.waiverSignatures.map((s: { version: number; waiverContentSnapshot: string }) => `${s.version}:${s.waiverContentSnapshot}`).sort())
      .toEqual(["1:signed v1 text", "2:current v2"]);
    expect(data.members.find((m: { id: string }) => m.id === a.member.id).hasStudentAccount).toBe(true);

    // Zero leakage.
    for (const forbidden of [b.gym.id, b.gym.name, b.member.id, SECRET_JOURNAL, SECRET_CODE, `${RUN}-owner-hash`, `${RUN}-student-hash`, `${RUN}-alpha-clerk`, "passwordHash", "clerkUserId", "checkinCode", "stripeCustomerId", `cus_${RUN}`]) {
      expect(text).not.toContain(forbidden);
    }
    expect(await fingerprint(a.gym.id)).toBe(before);
    // The audit entry records counts only, no record contents.
    expect(JSON.stringify(mocks.logged.at(-1))).not.toContain("@test.local");
  });

  it("F3: nonowners and locked-out owners cannot self-export; support path is platform-admin only", async () => {
    mocks.owner = null;
    expect((await ownerExport()).status).toBe(401);

    mocks.owner = { gymId: a.gym.id, memberId: a.owner.id, userId: "u" };
    mocks.lockedOut = true;
    const locked = await ownerExport();
    expect(locked.status).toBe(402);
    expect((await locked.json()).supportExport).toBeTruthy();
    mocks.lockedOut = false;

    const params = { params: Promise.resolve({ gymId: a.gym.id }) };
    mocks.session = { email: "owner.basic@e2e.matflow.test" };
    expect((await supportExport(new Request("http://x") as never, params)).status).toBe(403);
    mocks.session = null;
    expect((await supportExport(new Request("http://x") as never, params)).status).toBe(403);
    mocks.session = { email: "founder@e2e.matflow.test" };
    const ok = await supportExport(new Request("http://x") as never, params);
    expect(ok.status).toBe(200);
    expect((await ok.json()).academy.id).toBe(a.gym.id);
  });
});
