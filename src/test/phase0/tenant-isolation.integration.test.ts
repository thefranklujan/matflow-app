/**
 * Phase 0, item 4 (audit H1, M4 and owner-features finding 13): cross-tenant
 * reads in /members/** and /app/leaderboard, edit pages that load any gym's
 * row by id, member rows (passwordHash, checkinCode, clerkUserId) serialized
 * to the browser, and attendance written for another gym's members.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import type { ReactElement, ReactNode } from "react";

vi.mock("next/headers", async () => (await import("@/test/integration")).nextHeadersMock);
vi.mock("@/lib/prisma", async () => ({ prisma: (await import("@/test/integration")).testPrisma }));
vi.mock("@/lib/email", async () => (await import("@/test/integration")).emailMock);
vi.mock("@/lib/attendance-streak", () => ({ notifyStreakMilestonesForMembers: vi.fn(async () => {}) }));

import {
  db, dbConfigured, jar, req, params, navigationOutcome, cleanupFixtures, makeGym, makeOwner,
  makeStudentMember, tag,
} from "@/test/integration";
import { NextRequest } from "next/server";
import { createSession } from "@/lib/local-auth";
import { middleware } from "@/middleware";
import LeaderboardPage from "@/app/app/leaderboard/page";
import LeaderboardTable from "@/app/app/leaderboard/LeaderboardTable";
import EditProductPage from "@/app/app/products/[id]/edit/page";
import EditVideoPage from "@/app/app/videos/[id]/edit/page";
import { GET as listMembers } from "@/app/api/admin/members/route";
import { PUT as updateMember } from "@/app/api/admin/members/[id]/route";
import { GET as getAttendance, POST as postAttendance } from "@/app/api/admin/attendance/route";
import { GET as listCompetitions } from "@/app/api/admin/competitions/route";

type M = { id: string; gymId: string; clerkUserId: string; email: string; firstName: string; lastName: string };
async function signIn(m: M, role: "admin" | "member") {
  await createSession({
    userId: m.clerkUserId, email: m.email, name: `${m.firstName} ${m.lastName}`,
    role, gymId: m.gymId, memberId: m.id, userType: "member",
  });
}

function findElement(node: ReactNode, type: unknown): ReactElement<Record<string, unknown>> | null {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const hit = findElement(n, type);
      if (hit) return hit;
    }
    return null;
  }
  const el = node as ReactElement<{ children?: ReactNode }>;
  if (el.type === type) return el as ReactElement<Record<string, unknown>>;
  return findElement(el.props?.children, type);
}

const SECRET_FIELDS = ["passwordHash", "checkinCode", "clerkUserId"];

describe.skipIf(!dbConfigured)("Tenant isolation", () => {
  let ownerA: M;
  let memberA: M;
  let memberB: M;
  let gymB: string;

  beforeAll(async () => {
    const a = await makeGym();
    const b = await makeGym();
    gymB = b.id;
    ownerA = await makeOwner(a.id);
    memberA = (await makeStudentMember(a.id, { member: { checkinCode: "123456" } })).member;
    await makeOwner(b.id);
    memberB = (await makeStudentMember(b.id)).member;

    // Gym B activity this month, heavy enough to top any global leaderboard.
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const span = now.getTime() - monthStart - 120_000;
    await db().attendance.createMany({
      data: Array.from({ length: 40 }, (_, i) => ({
        gymId: b.id, memberId: memberB.id, classType: "Gi", locationSlug: "main",
        classDate: new Date(monthStart + 60_000 + Math.floor((span * i) / 40)),
      })),
    });
    await db().attendance.create({ data: { gymId: a.id, memberId: memberA.id, classType: "Gi", locationSlug: "main", classDate: new Date(now.getTime() - 60_000) } });
    await db().competitionResult.create({ data: { gymId: b.id, memberId: memberB.id, competitionName: "Open", date: new Date(now.getTime() - 60_000), placement: "gold" } });
    await db().personalGoal.create({ data: { gymId: b.id, memberId: memberB.id, title: "Drill", targetValue: 1, goalType: "classes", startDate: new Date(monthStart), completed: true } });
  });
  afterAll(cleanupFixtures);
  beforeEach(() => jar.clear());

  it("/members/* redirects to /student instead of rendering the legacy portal", async () => {
    for (const path of ["/members", "/members/videos", "/members/leaderboard?period=year"]) {
      const res = middleware(new NextRequest(`http://localhost${path}`, { headers: { cookie: "matflow-session=x" } }));
      expect(res.status).toBe(307);
      expect(new URL(res.headers.get("location")!).pathname).toBe("/student");
    }
  });

  for (const category of ["overall", "gi", "streaks", "competitions", "goals"]) {
    it(`/app/leaderboard (${category}) shows only the caller's gym`, async () => {
      await signIn(memberA, "member");
      const tree = await LeaderboardPage({ searchParams: Promise.resolve({ category, period: "month" }) });
      const table = findElement(tree, LeaderboardTable);
      expect(table).not.toBeNull();
      const entries = table!.props.entries as { memberId: string }[];
      expect(entries.map((e) => e.memberId)).not.toContain(memberB.id);
      const gyms = await db().member.findMany({ where: { id: { in: entries.map((e) => e.memberId) } }, select: { gymId: true } });
      expect(gyms.every((g) => g.gymId === memberA.gymId)).toBe(true);
    });
  }

  it("product and video edit pages refuse another gym's row and non-admins", async () => {
    const t = tag();
    const category = await db().category.create({ data: { gymId: gymB, name: "Gear", slug: `gear-${t}` } });
    const product = await db().product.create({ data: { gymId: gymB, name: "Gi", slug: `gi-${t}`, description: "x", price: 100, categoryId: category.id } });
    const video = await db().video.create({ data: { gymId: gymB, title: "Unpublished", embedUrl: "https://example.com/v", classType: "Gi", classDate: new Date(), published: false } });

    await signIn(ownerA, "admin");
    expect(await navigationOutcome(EditProductPage(params({ id: product.id })))).not.toBe("rendered");
    expect(await navigationOutcome(EditVideoPage(params({ id: video.id })))).not.toBe("rendered");

    jar.clear();
    await signIn(memberB, "member"); // same gym, but not an admin
    expect(await navigationOutcome(EditProductPage(params({ id: product.id })))).not.toBe("rendered");
    expect(await navigationOutcome(EditVideoPage(params({ id: video.id })))).not.toBe("rendered");
  });

  it("GET /api/admin/members never serializes passwordHash, checkinCode or clerkUserId", async () => {
    await signIn(ownerA, "admin");
    const res = await listMembers();
    expect(res.status).toBe(200);
    const rows = (await res.json()) as Record<string, unknown>[];
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) for (const f of SECRET_FIELDS) expect(r).not.toHaveProperty(f);
  });

  it("member PUT response and attendance GET never serialize member secrets", async () => {
    await signIn(ownerA, "admin");
    const put = await updateMember(req(`/api/admin/members/${memberA.id}`, { method: "PUT", body: { stripes: 1 } }), params({ id: memberA.id }));
    expect(put.status).toBe(200);
    const updated = await put.json();
    for (const f of SECRET_FIELDS) expect(updated).not.toHaveProperty(f);

    // Same local-time arithmetic as the route, so the row is inside its day window.
    const at = new Date("2026-01-20");
    at.setHours(12, 0, 0, 0);
    await db().attendance.create({ data: { gymId: memberA.gymId, memberId: memberA.id, classType: "Gi", locationSlug: "main", classDate: at } });
    const get = await getAttendance(req("/api/admin/attendance?classDate=2026-01-20&classType=Gi"));
    const records = (await get.json()) as { member: Record<string, unknown> }[];
    expect(records.length).toBeGreaterThan(0);
    for (const r of records) for (const f of SECRET_FIELDS) expect(r.member).not.toHaveProperty(f);
  });

  it("GET /api/admin/competitions never serializes member secrets", async () => {
    process.env.STRIPE_PRO_PRICE_ID = "price_p0_pro";
    const pro = await makeGym({ subscriptionStatus: "active", stripePriceId: "price_p0_pro", trialEndsAt: null });
    const proOwner = await makeOwner(pro.id);
    const athlete = (await makeStudentMember(pro.id, { member: { checkinCode: "654321" } })).member;
    await db().competitionResult.create({ data: { gymId: pro.id, memberId: athlete.id, competitionName: "Open", date: new Date(), placement: "silver" } });
    await signIn(proOwner, "admin");
    const res = await listCompetitions();
    expect(res.status).toBe(200);
    const rows = (await res.json()) as { member: Record<string, unknown> }[];
    expect(rows.length).toBe(1);
    for (const f of SECRET_FIELDS) expect(rows[0].member).not.toHaveProperty(f);
  });

  it("POST /api/admin/attendance ignores memberIds from another gym", async () => {
    await signIn(ownerA, "admin");
    const classDate = "2026-01-15T18:00:00.000Z";
    const res = await postAttendance(req("/api/admin/attendance", { body: { classDate, classType: "No-Gi", memberIds: [memberA.id, memberB.id] } }));
    expect(res.status).toBe(201);
    expect((await res.json()).count).toBe(1);
    expect(await db().attendance.count({ where: { memberId: memberB.id, classDate: new Date(classDate) } })).toBe(0);
    expect(await db().attendance.count({ where: { memberId: memberA.id, classDate: new Date(classDate) } })).toBe(1);
  });
});
