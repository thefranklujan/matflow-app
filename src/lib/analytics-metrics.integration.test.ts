/**
 * REAL-Postgres fixture tests for the owner analytics metrics (Basic + Pro).
 * Same integrity semantics as the member-capacity suite: configured-but-down
 * DB fails loudly; missing URL skips explicitly; env is never mutated.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";
import { getBasicAnalytics, getProAnalytics } from "./analytics-metrics";

function localDbUrl(): string | null {
  try {
    const env = readFileSync(join(__dirname, "../../.env.local"), "utf8");
    const m = env.match(/^DATABASE_URL=("?)(.+?)\1$/m);
    const url = m?.[2] ?? null;
    if (url && /localhost|127\.0\.0\.1/.test(url)) return url;
    return null;
  } catch {
    return null;
  }
}

const url = localDbUrl();
let prisma: PrismaClient | null = null;
let dbUp = false;
const GYM_ID = "analytics-test-gym";
// Fixed "now": mid-month, mid-week, so boundaries are unambiguous.
const NOW = new Date("2026-07-15T12:00:00");

function d(iso: string) {
  return new Date(iso);
}

beforeAll(async () => {
  if (!url) return;
  prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbUp = true;
    console.log("[analytics.integration] REAL POSTGRES CONNECTED");
  } catch {
    throw new Error("analytics integration: local DATABASE_URL configured but unreachable — start the dev DB or remove the URL.");
  }
  await prisma.gym.deleteMany({ where: { id: GYM_ID } });
  await prisma.gym.create({
    data: {
      id: GYM_ID,
      clerkOrgId: `analytics-test-${Date.now()}`,
      name: "Analytics Test Gym",
      slug: `analytics-test-${Date.now()}`,
      subscriptionStatus: "trialing",
      trialEndsAt: new Date(NOW.getTime() + 7 * 24 * 3600 * 1000),
      approved: true,
    },
  });
  // Members: m1 created LAST month (blue), m2 created THIS month before "now"
  // (white), m3 inactive (should not count in belts/actives), m4 created this
  // month, never attended (inactivity risk "Never").
  await prisma.member.createMany({
    data: [
      { id: "an-m1", gymId: GYM_ID, clerkUserId: "an-m1", email: "m1@an.test", firstName: "Ana", lastName: "One", beltRank: "blue", active: true, approved: true, createdAt: d("2026-06-10T10:00:00") },
      { id: "an-m2", gymId: GYM_ID, clerkUserId: "an-m2", email: "m2@an.test", firstName: "Bob", lastName: "Two", beltRank: "white", active: true, approved: true, createdAt: d("2026-07-02T10:00:00") },
      { id: "an-m3", gymId: GYM_ID, clerkUserId: "an-m3", email: "m3@an.test", firstName: "Cat", lastName: "Three", beltRank: "purple", active: false, approved: true, createdAt: d("2026-05-20T10:00:00") },
      { id: "an-m4", gymId: GYM_ID, clerkUserId: "an-m4", email: "m4@an.test", firstName: "Dan", lastName: "Four", beltRank: "white", active: true, approved: true, createdAt: d("2026-07-05T10:00:00") },
    ],
  });
  // Attendance: m1 trains recently (2 gi this month, 1 nogi LAST month —
  // boundary check); m2's last check-in was >30 days before NOW (risk).
  await prisma.attendance.createMany({
    data: [
      { gymId: GYM_ID, memberId: "an-m1", classDate: d("2026-07-07T18:00:00"), classType: "gi", locationSlug: "main" },
      { gymId: GYM_ID, memberId: "an-m1", classDate: d("2026-07-14T18:00:00"), classType: "gi", locationSlug: "main" },
      { gymId: GYM_ID, memberId: "an-m1", classDate: d("2026-06-30T18:00:00"), classType: "nogi", locationSlug: "main" },
      { gymId: GYM_ID, memberId: "an-m2", classDate: d("2026-06-10T18:00:00"), classType: "gi", locationSlug: "main" },
    ],
  });
}, 30_000);

afterAll(async () => {
  if (prisma && dbUp) await prisma.gym.deleteMany({ where: { id: GYM_ID } });
  await prisma?.$disconnect();
});

describe.skipIf(!url)("owner analytics metrics (real Postgres fixtures)", () => {
  it("Basic: counts, month boundaries, belts, top classes", async () => {
    expect(dbUp, "real-Postgres setup must have run").toBe(true);
    const b = await getBasicAnalytics(prisma!, GYM_ID, NOW);
    expect(b.totalMembers).toBe(3); // m3 inactive excluded
    expect(b.newThisMonth).toBe(2); // m2 + m4 (July)
    expect(b.newLastMonth).toBe(1); // m1 (June)
    expect(b.attendanceThisMonth).toBe(2); // two July check-ins
    expect(b.attendanceLastMonth).toBe(2); // June 30 + June 10
    expect(b.beltDistribution).toEqual([
      { belt: "white", count: 2 },
      { belt: "blue", count: 1 },
      { belt: "purple", count: 0 }, // m3 inactive
      { belt: "brown", count: 0 },
      { belt: "black", count: 0 },
    ]);
    expect(b.topClasses).toEqual([{ classType: "gi", count: 2 }]); // July only
  });

  it("Pro: weekly buckets, monthly growth, inactivity risk", async () => {
    expect(dbUp, "real-Postgres setup must have run").toBe(true);
    const p = await getProAnalytics(prisma!, GYM_ID, NOW, { weeks: 4, months: 3 });

    expect(p.weeklyAttendance).toHaveLength(4);
    const total = p.weeklyAttendance.reduce((s, w) => s + w.count, 0);
    expect(total).toBe(3); // Jun 30 + Jul 7 + Jul 14 fall in the 4-week window
    expect(p.weeklyAttendance[3].count).toBe(1); // current week (Jul 13-19): Jul 14

    expect(p.memberGrowth).toEqual([
      { month: "2026-05", count: 1 }, // m3 (growth counts creations, any status)
      { month: "2026-06", count: 1 }, // m1
      { month: "2026-07", count: 2 }, // m2 + m4
    ]);

    // m2 last trained Jun 10 (>30d before Jul 15) and m4 never trained; m1 is
    // current. Never-trained sorts before dated entries.
    expect(p.inactivityRisk.map((r) => [r.name, r.lastCheckIn])).toEqual([
      ["Dan Four", null],
      ["Bob Two", "2026-06-10"],
    ]);
  });
});
