/**
 * Packet B — waiver revisions and signatures (REAL Postgres).
 *
 * Reproduced pre-fix on 2026-10-24 against the original route: after an owner
 * content edit (v2 → v3) GET still reported signed=true and POST for v3
 * returned 400 "Already signed".
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import { randomUUID } from "crypto";

const mocks = vi.hoisted(() => ({
  member: { gymId: "", memberId: "" },
  owner: { gymId: "" },
  session: null as null | { studentId?: string; email: string },
  notify: vi.fn(async () => {}),
}));

vi.mock("@/lib/prisma", async () => ({
  prisma: (await import("@/lib/test-integration-prisma")).integrationPrisma(),
}));
vi.mock("@/lib/auth", () => ({ requireMember: async () => mocks.member }));
vi.mock("@/lib/owner-access", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/owner-access")>()),
  requireOwnerAccess: async () => mocks.owner,
}));
vi.mock("@/lib/local-auth", () => ({ getSession: async () => mocks.session }));
vi.mock("@/lib/push", () => ({ notify: mocks.notify }));
vi.mock("@/lib/activity-log", () => ({ logActivity: () => {} }));

import { integrationDb, integrationPrisma } from "./test-integration-prisma";
import { countCurrentSignatures } from "./waiver";
import * as memberRoute from "@/app/api/members/waiver/route";
import * as studentRoute from "@/app/api/student/academy/[gymId]/waiver/route";
import * as adminRoute from "@/app/api/admin/waivers/route";

const db = integrationDb();
const prisma = integrationPrisma();
const RUN = `pb${randomUUID().slice(0, 8)}`;
const gymIds: string[] = [];
const studentIds: string[] = [];

function req(body: unknown, method = "POST") {
  const init = method === "GET" ? { method } : { method, body: JSON.stringify(body) };
  return new Request("http://localhost/x", init) as unknown as import("next/server").NextRequest;
}
const params = (gymId: string) => ({ params: Promise.resolve({ gymId }) });

async function fixture(label: string) {
  const gym = await prisma.gym.create({
    data: { clerkOrgId: `${RUN}-${label}`, name: `${RUN} ${label}`, slug: `${RUN}-${label}`, approved: true },
  });
  gymIds.push(gym.id);
  const student = await prisma.student.create({
    data: { email: `${RUN}-${label}@test.local`, firstName: "Sam", lastName: label, passwordHash: "x" },
  });
  studentIds.push(student.id);
  const member = await prisma.member.create({
    data: { gymId: gym.id, clerkUserId: `${RUN}-${label}`, email: `${RUN}-${label}@test.local`, firstName: "Sam", lastName: label, studentId: student.id },
  });
  mocks.owner = { gymId: gym.id };
  const created = await adminRoute.POST(req({ title: "Liability", content: "Version one text" }));
  expect(created.status).toBe(201);
  const template = await created.json();
  // The creation notification is fire-and-forget; settle it so each test
  // observes only the notifications its own actions cause.
  await vi.waitFor(() => expect(mocks.notify).toHaveBeenCalled());
  mocks.notify.mockClear();
  mocks.member = { gymId: gym.id, memberId: member.id };
  mocks.session = { studentId: student.id, email: student.email };
  return { gym, student, member, template };
}

async function memberStatus() {
  return (await memberRoute.GET()).json();
}
async function sign(templateId: string, version: number | undefined, name = "Sam Synthetic") {
  return memberRoute.POST(req({ templateId, version, signedName: name }));
}
async function editContent(id: string, title: string, content: string) {
  const res = await adminRoute.PUT(req({ id, title, content }, "PUT"));
  expect(res.status).toBe(200);
  return res.json();
}

describe.skipIf(!db)("Packet B — waiver versions (real Postgres)", () => {
  beforeAll(async () => {
    await prisma.$queryRaw`SELECT 1`;
  });
  beforeEach(() => mocks.notify.mockClear());
  afterAll(async () => {
    await prisma.gym.deleteMany({ where: { id: { in: gymIds } } });
    await prisma.student.deleteMany({ where: { id: { in: studentIds } } });
    await prisma.$disconnect();
  });

  it("B1/B2: sign v1 → content edit → current v2 unsigned → sign v2; v1 record untouched", async () => {
    const f = await fixture("b1");
    const v1 = f.template.version;
    expect((await memberStatus()).status).toBe("unsigned");
    expect((await sign(f.template.id, v1)).status).toBe(201);
    const s1 = await memberStatus();
    expect(s1.status).toBe("current_signed");
    const v1Row = await prisma.waiverSignature.findFirstOrThrow({ where: { memberId: f.member.id } });

    const edited = await editContent(f.template.id, "Liability", "Version two text");
    expect(edited.version).toBe(v1 + 1);

    const s2 = await memberStatus();
    expect(s2.status).toBe("previous_version_signed");
    expect(s2.signed).toBe(false);
    expect(s2.template.version).toBe(v1 + 1);
    expect(s2.previous.version).toBe(v1);

    const res = await sign(f.template.id, v1 + 1);
    expect(res.status).toBe(201);
    expect((await memberStatus()).status).toBe("current_signed");

    const rows = await prisma.waiverSignature.findMany({ where: { memberId: f.member.id }, orderBy: { version: "asc" } });
    expect(rows.map((r) => [r.version, r.waiverContentSnapshot])).toEqual([
      [v1, "Version one text"],
      [v1 + 1, "Version two text"],
    ]);
    // B2: the original record is byte-identical after the revision.
    expect(rows[0]).toEqual(v1Row);
  });

  it("B3: duplicate and concurrent submissions of one version create exactly one signature", async () => {
    const f = await fixture("b3");
    const v = f.template.version;
    const results = await Promise.all(Array.from({ length: 6 }, () => sign(f.template.id, v)));
    const statuses = results.map((r) => r.status).sort();
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 200)).toHaveLength(5);
    expect(await prisma.waiverSignature.count({ where: { memberId: f.member.id } })).toBe(1);
  });

  it("B3: signing concurrently with a content edit never pairs a snapshot with the wrong version", async () => {
    const f = await fixture("b3race");
    const v = f.template.version;
    await Promise.all([
      sign(f.template.id, v),
      editContent(f.template.id, "Liability", "Raced version text"),
    ]);
    const rows = await prisma.waiverSignature.findMany({ where: { memberId: f.member.id } });
    for (const r of rows) {
      expect(r.waiverContentSnapshot).toBe(r.version === v ? "Version one text" : "Raced version text");
    }
  });

  it("B4: a stale version is refused with the new waiver attached; nothing is recorded", async () => {
    const f = await fixture("b4");
    const shown = f.template.version;
    await editContent(f.template.id, "Liability", "Changed while the form was open");
    const res = await sign(f.template.id, shown);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("WAIVER_UPDATED");
    expect(body.current.template.version).toBe(shown + 1);
    expect(body.current.template.content).toBe("Changed while the form was open");
    expect(await prisma.waiverSignature.count({ where: { memberId: f.member.id } })).toBe(0);
    // An old client that sends no version is treated as stale, never as consent.
    expect((await sign(f.template.id, undefined)).status).toBe(409);
  });

  it("B5: a title-only edit keeps the version and the signed state", async () => {
    const f = await fixture("b5");
    await sign(f.template.id, f.template.version);
    const edited = await editContent(f.template.id, "Renamed waiver", "Version one text");
    expect(edited.version).toBe(f.template.version);
    expect((await memberStatus()).status).toBe("current_signed");
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it("inactive/replaced templates: signing a replaced template is refused; status follows the new one", async () => {
    const f = await fixture("inactive");
    const replaced = await adminRoute.POST(req({ title: "Replacement", content: "Brand new waiver" }));
    const next = await replaced.json();
    const res = await sign(f.template.id, f.template.version);
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("WAIVER_INACTIVE");
    const s = await memberStatus();
    expect(s.template.id).toBe(next.id);
    expect(s.status).toBe("unsigned");
  });

  it("B6: another tenant cannot read or sign; a revoked membership cannot sign", async () => {
    const a = await fixture("b6a");
    const b = await fixture("b6b"); // session now belongs to student B
    // Student B targets academy A's waiver by id.
    const read = await studentRoute.GET(req({}, "GET"), params(a.gym.id));
    expect(read.status).toBe(403);
    const write = await studentRoute.POST(req({ templateId: a.template.id, version: a.template.version, signedName: "x" }), params(a.gym.id));
    expect(write.status).toBe(403);
    // Member route: B's member context cannot sign A's template (gym-scoped lookup).
    expect((await sign(a.template.id, a.template.version)).status).toBe(404);
    expect(await prisma.waiverSignature.count({ where: { gymId: a.gym.id } })).toBe(0);

    // Revocation: B's membership is deactivated after the session was issued.
    await prisma.member.update({ where: { id: b.member.id }, data: { active: false } });
    expect((await studentRoute.GET(req({}, "GET"), params(b.gym.id))).status).toBe(403);
    const revoked = await sign(b.template.id, b.template.version);
    expect(revoked.status).toBe(403);
    expect((await revoked.json()).code).toBe("MEMBERSHIP_INACTIVE");
    expect(await prisma.waiverSignature.count({ where: { gymId: b.gym.id } })).toBe(0);
  });

  it("B7: the revision notification deep-links to the student academy view of this gym's waiver, which signs successfully", async () => {
    const f = await fixture("b7");
    mocks.notify.mockClear();
    await editContent(f.template.id, "Liability", "Revised for B7");
    await vi.waitFor(() => expect(mocks.notify).toHaveBeenCalledTimes(1));
    const call = (mocks.notify.mock.calls[0] as unknown as [{ url: string; externalIds: string[]; kind: string }])[0];
    expect(call.kind).toBe("waiver_required");
    expect(call.url).toBe(`/student/academy?gym=${encodeURIComponent(f.gym.id)}#waiver`);
    expect(call.externalIds).toEqual([`student-${f.student.id}`]);

    const status = await (await studentRoute.GET(req({}, "GET"), params(f.gym.id))).json();
    expect(status.status).toBe("unsigned");
    const res = await studentRoute.POST(
      req({ templateId: status.template.id, version: status.template.version, signedName: "Sam" }),
      params(f.gym.id),
    );
    expect(res.status).toBe(201);
  });

  it("B8: owner counts use the current version and active members only", async () => {
    const f = await fixture("b8");
    const other = await prisma.member.create({
      data: { gymId: f.gym.id, clerkUserId: `${RUN}-b8-other`, email: `${RUN}-b8-other@test.local`, firstName: "O", lastName: "O" },
    });
    await sign(f.template.id, f.template.version);
    mocks.member = { gymId: f.gym.id, memberId: other.id };
    await sign(f.template.id, f.template.version);
    await editContent(f.template.id, "Liability", "B8 v2");
    mocks.member = { gymId: f.gym.id, memberId: f.member.id };
    await sign(f.template.id, f.template.version + 1);

    const t = await prisma.waiverTemplate.findUniqueOrThrow({ where: { id: f.template.id }, include: { signatures: true } });
    const active = await prisma.member.findMany({ where: { gymId: f.gym.id, active: true, approved: true }, select: { id: true } });
    const counts = countCurrentSignatures(t, new Set(active.map((m) => m.id)));
    expect(counts).toEqual({ signed: 1, previousVersionOnly: 1, pending: 1 });
  });
});
