/**
 * Packet A — community data must survive academy acquisition.
 *
 * REAL Postgres (the approved disposable test database): the original defect
 * was a cascade delete, which a mocked Prisma cannot reproduce. Reproduced
 * pre-fix on 2026-10-24: owner registration took community/member/post counts
 * from 1/1/1 to 0/0/0.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import { randomUUID } from "crypto";

const mocks = vi.hoisted(() => ({ getSession: vi.fn() }));

vi.mock("@/lib/prisma", async () => ({
  prisma: (await import("@/lib/test-integration-prisma")).integrationPrisma(),
}));
vi.mock("@/lib/local-auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/local-auth")>()),
  getSession: mocks.getSession,
}));

import { integrationDb, integrationPrisma } from "./test-integration-prisma";
import { registerGymOwner } from "./local-auth";
import { claimNominationsForGym, findNominationReviewMatches } from "./nomination-claim";
import { POST as claimRoute } from "@/app/api/platform/nominations/claim/route";

const db = integrationDb();
const prisma = integrationPrisma();
const RUN = `pa${randomUUID().slice(0, 8)}`;
const FOUNDER = "founder@e2e.matflow.test";

const createdStudentIds: string[] = [];
const createdGymIds: string[] = [];
const createdGroupIds: string[] = [];

async function student(label: string) {
  const s = await prisma.student.create({
    data: {
      email: `${RUN}-${label}@test.local`,
      firstName: label,
      lastName: "Synthetic",
      passwordHash: "x",
      beltRank: "blue",
    },
  });
  createdStudentIds.push(s.id);
  return s;
}

/** A nominated academy with a full community: nominator mod, a non-nominating
 *  member, one post with a comment, a like and a report. */
async function community(name: string, city: string | null, state: string | null) {
  const nominator = await student(`nom-${createdStudentIds.length}`);
  const bystander = await student(`member-${createdStudentIds.length}`);
  const groupId = `${RUN}-${name}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  createdGroupIds.push(groupId);
  const nomination = await prisma.gymNomination.create({
    data: { studentId: nominator.id, gymName: name, city, state },
  });
  await prisma.gymGroup.create({ data: { id: groupId, name, city, state, memberCount: 2 } });
  await prisma.gymGroupMember.createMany({
    data: [
      { groupId, studentId: nominator.id, role: "mod", status: "active" },
      { groupId, studentId: bystander.id, role: "member", status: "active" },
    ],
  });
  const post = await prisma.groupPost.create({
    data: { groupId, studentId: nominator.id, body: "Open mat Saturday" },
  });
  await prisma.postComment.create({ data: { postId: post.id, studentId: bystander.id, body: "See you there" } });
  await prisma.postLike.create({ data: { postId: post.id, studentId: bystander.id } });
  await prisma.postReport.create({ data: { postId: post.id, reporterId: bystander.id, reason: "test" } });
  return { groupId, nomination, nominator, bystander, post };
}

async function communityCounts(groupId: string) {
  const [groups, members, posts, comments, likes, reports] = await Promise.all([
    prisma.gymGroup.count({ where: { id: groupId } }),
    prisma.gymGroupMember.count({ where: { groupId } }),
    prisma.groupPost.count({ where: { groupId } }),
    prisma.postComment.count({ where: { post: { groupId } } }),
    prisma.postLike.count({ where: { post: { groupId } } }),
    prisma.postReport.count({ where: { post: { groupId } } }),
  ]);
  return { groups, members, posts, comments, likes, reports };
}

const INTACT = { groups: 1, members: 2, posts: 1, comments: 1, likes: 1, reports: 1 };

async function ownerGym(name: string, city: string | null = null, state: string | null = null) {
  const slug = `${RUN}-${createdGymIds.length}-${name}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const r = await registerGymOwner({
    email: `${slug}@owner.test.local`,
    password: "Synthetic-Passw0rd!",
    firstName: "Owner",
    lastName: "Synthetic",
    gymName: name,
    gymSlug: slug,
  });
  createdGymIds.push(r.gym.id);
  if (city || state) await prisma.gym.update({ where: { id: r.gym.id }, data: { city, state } });
  return r.gym;
}

function claimRequest(body: unknown) {
  return new Request("http://localhost/api/platform/nominations/claim", {
    method: "POST",
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;
}

describe.skipIf(!db)("Packet A — community preservation (real Postgres)", () => {
  beforeAll(async () => {
    await prisma.$queryRaw`SELECT 1`;
    process.env.PLATFORM_ADMIN_EMAILS = FOUNDER;
  });

  beforeEach(() => {
    mocks.getSession.mockResolvedValue({ email: FOUNDER, gymId: "platform-owner-gym", memberId: "m", role: "admin", userId: "u", name: "Founder" });
  });

  afterAll(async () => {
    await prisma.gymGroup.deleteMany({ where: { id: { in: createdGroupIds } } });
    await prisma.gym.deleteMany({ where: { id: { in: createdGymIds } } });
    await prisma.student.deleteMany({ where: { id: { in: createdStudentIds } } });
    await prisma.$disconnect();
  });

  it("A1/A6: owner registration with a same-name nominated community keeps every post, comment, like, report and membership", async () => {
    const name = `${RUN} Alpha BJJ`;
    const c = await community(name, "Houston", "TX");
    expect(await communityCounts(c.groupId)).toEqual(INTACT);

    const gym = await ownerGym(name);

    expect(await communityCounts(c.groupId)).toEqual(INTACT);
    // Name equality is not ownership: the nomination stays open for review,
    // no join request is fabricated, and nobody is moved into the academy.
    const nom = await prisma.gymNomination.findUniqueOrThrow({ where: { id: c.nomination.id } });
    expect(nom.status).toBe("new");
    expect(await prisma.joinRequest.count({ where: { gymId: gym.id } })).toBe(0);
    // ...and it is visibly pending review rather than silently completed.
    const review = await findNominationReviewMatches([nom]);
    expect(review.get(nom.id)?.map((m) => m.gymId)).toContain(gym.id);
    // A6: the preserved community is still readable by its members.
    const visible = await prisma.gymGroupMember.findMany({ where: { studentId: c.bystander.id, groupId: c.groupId } });
    expect(visible).toHaveLength(1);
  });

  it("A1: founder claim of explicit nominations creates join requests and still deletes nothing", async () => {
    const name = `${RUN} Bravo BJJ`;
    const c = await community(name, "Austin", "TX");
    const gym = await ownerGym(name, "Austin", "TX");

    const res = await claimRoute(claimRequest({ targetGymId: gym.id, nominationIds: [c.nomination.id] }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.joinRequestsCreated).toBe(1);

    expect(await communityCounts(c.groupId)).toEqual(INTACT);
    expect((await prisma.gymNomination.findUniqueOrThrow({ where: { id: c.nomination.id } })).status).toBe("claimed");
    const jr = await prisma.joinRequest.findMany({ where: { gymId: gym.id } });
    expect(jr.map((j) => j.studentId)).toEqual([c.nominator.id]);
    // Non-nominating community members are not moved into the academy.
    expect(await prisma.member.count({ where: { gymId: gym.id, studentId: c.bystander.id } })).toBe(0);
  });

  it("A2: same-name academies in different places cannot claim each other's community", async () => {
    const name = `${RUN} Charlie BJJ`;
    const dallas = await community(name, "Dallas", "TX");
    const gymElsewhere = await ownerGym(name, "Miami", "FL");

    const res = await claimRoute(claimRequest({ targetGymId: gymElsewhere.id, nominationIds: [dallas.nomination.id] }));
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("LOCATION_MISMATCH");
    expect((await prisma.gymNomination.findUniqueOrThrow({ where: { id: dallas.nomination.id } })).status).toBe("new");
    expect(await prisma.joinRequest.count({ where: { gymId: gymElsewhere.id } })).toBe(0);
    expect(await communityCounts(dallas.groupId)).toEqual(INTACT);

    // Review matches report the conflict instead of a likely match.
    const review = await findNominationReviewMatches([dallas.nomination]);
    expect(review.get(dallas.nomination.id)?.find((m) => m.gymId === gymElsewhere.id)?.location).toBe("conflict");
  });

  it("A2: the legacy name-only claim body is refused rather than claiming every same-name nomination", async () => {
    const res = await claimRoute(claimRequest({ groupName: "Anything", targetGymId: "x" }));
    expect(res.status).toBe(400);
  });

  it("A3: retrying a claim is a no-op — no duplicate join request, no side effects", async () => {
    const name = `${RUN} Delta BJJ`;
    const c = await community(name, null, null);
    const gym = await ownerGym(name);

    const first = await claimNominationsForGym({ targetGymId: gym.id, nominationIds: [c.nomination.id] });
    const [second, third] = await Promise.all([
      claimNominationsForGym({ targetGymId: gym.id, nominationIds: [c.nomination.id] }),
      claimNominationsForGym({ targetGymId: gym.id, nominationIds: [c.nomination.id] }),
    ]);
    expect(first.joinRequestsCreated).toBe(1);
    expect(second.joinRequestsCreated + third.joinRequestsCreated).toBe(0);
    expect(await prisma.joinRequest.count({ where: { gymId: gym.id } })).toBe(1);
    expect(await communityCounts(c.groupId)).toEqual(INTACT);
  });

  it("A3: a previously rejected join request is never resurrected by a claim", async () => {
    const name = `${RUN} Echo BJJ`;
    const c = await community(name, null, null);
    const gym = await ownerGym(name);
    await prisma.joinRequest.create({ data: { studentId: c.nominator.id, gymId: gym.id, status: "rejected" } });

    const r = await claimNominationsForGym({ targetGymId: gym.id, nominationIds: [c.nomination.id] });
    expect(r.joinRequestsCreated).toBe(0);
    expect(r.skippedRejected).toBe(1);
    expect((await prisma.joinRequest.findFirstOrThrow({ where: { gymId: gym.id } })).status).toBe("rejected");
  });

  it("A4: an injected failure mid-claim rolls back — no claimed status, no join request", async () => {
    const name = `${RUN} Foxtrot BJJ`;
    const c = await community(name, null, null);
    const gym = await ownerGym(name);

    await expect(
      claimNominationsForGym({
        targetGymId: gym.id,
        nominationIds: [c.nomination.id],
        afterEachForTest: () => { throw new Error("injected failure"); },
      }),
    ).rejects.toThrow("injected failure");
    expect((await prisma.gymNomination.findUniqueOrThrow({ where: { id: c.nomination.id } })).status).toBe("new");
    expect(await prisma.joinRequest.count({ where: { gymId: gym.id } })).toBe(0);
    expect(await communityCounts(c.groupId)).toEqual(INTACT);
  });

  it("A5: a non-founder cannot claim; unrelated tenant data is unchanged", async () => {
    const name = `${RUN} Golf BJJ`;
    const c = await community(name, null, null);
    const gym = await ownerGym(name);
    mocks.getSession.mockResolvedValue({ email: "owner.basic@e2e.matflow.test", gymId: gym.id, memberId: "m", role: "admin", userId: "u", name: "Owner" });

    const res = await claimRoute(claimRequest({ targetGymId: gym.id, nominationIds: [c.nomination.id] }));
    expect(res.status).toBe(403);
    expect((await prisma.gymNomination.findUniqueOrThrow({ where: { id: c.nomination.id } })).status).toBe("new");
    expect(await prisma.joinRequest.count({ where: { gymId: gym.id } })).toBe(0);
    expect(await communityCounts(c.groupId)).toEqual(INTACT);
  });
});
