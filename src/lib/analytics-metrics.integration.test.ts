/**
 * REAL-Postgres fixture tests for the owner analytics metrics (Basic + Pro).
 * Same integrity semantics as the member-capacity suite: configured-but-down
 * DB fails loudly; missing URL skips explicitly; env is never mutated.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { join } from "path";
import { safeTestDbFromEnvFile } from "./test-db-safety";
import { PrismaClient } from "@prisma/client";
import { getBasicAnalytics, getProAnalytics } from "./analytics-metrics";

// Central URL-parsing safety gate (no regex): throws on a configured-but-
// unapproved URL, returns null only when nothing is configured.
const safeDb = safeTestDbFromEnvFile(join(__dirname, "../.."));
const url = safeDb?.url ?? null;
let prisma: PrismaClient | null = null;
let dbUp = false;
const GYM_ID = "analytics-test-gym";
// Fixed "now": mid-month, mid-week, so boundaries are unambiguous.
const NOW = new Date("2026-07-15T12:00:00");
// Exactly the inactivity cutoff (NOW minus 30 days) for the boundary case.
const NOW_MINUS_30D = new Date(NOW.getTime() - 30 * 24 * 3600 * 1000);

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
  // Members:
  //  m1 blue, created June, trains recently (current)
  //  m2 white, created July 2, last check-in >30d before NOW  -> AT RISK (dated)
  //  m3 purple, INACTIVE                                      -> excluded
  //  m4 white, created July 5 (10 days old), never attended   -> NOT at risk (too new)
  //  m5 white, created April, never attended                  -> AT RISK (never)
  //  m6 white, created April, check-in EXACTLY at the cutoff  -> NOT at risk (boundary)
  await prisma.member.createMany({
    data: [
      { id: "an-m1", gymId: GYM_ID, clerkUserId: "an-m1", email: "m1@an.test", firstName: "Ana", lastName: "One", beltRank: "blue", active: true, approved: true, createdAt: d("2026-06-10T10:00:00") },
      { id: "an-m2", gymId: GYM_ID, clerkUserId: "an-m2", email: "m2@an.test", firstName: "Bob", lastName: "Two", beltRank: "white", active: true, approved: true, createdAt: d("2026-07-02T10:00:00") },
      { id: "an-m3", gymId: GYM_ID, clerkUserId: "an-m3", email: "m3@an.test", firstName: "Cat", lastName: "Three", beltRank: "purple", active: false, approved: true, createdAt: d("2026-05-20T10:00:00") },
      { id: "an-m4", gymId: GYM_ID, clerkUserId: "an-m4", email: "m4@an.test", firstName: "Dan", lastName: "Four", beltRank: "white", active: true, approved: true, createdAt: d("2026-07-05T10:00:00") },
      { id: "an-m5", gymId: GYM_ID, clerkUserId: "an-m5", email: "m5@an.test", firstName: "Eve", lastName: "Five", beltRank: "white", active: true, approved: true, createdAt: d("2026-04-01T10:00:00") },
      { id: "an-m6", gymId: GYM_ID, clerkUserId: "an-m6", email: "m6@an.test", firstName: "Fay", lastName: "Six", beltRank: "white", active: true, approved: true, createdAt: d("2026-04-01T10:00:00") },
    ],
  });
  // Attendance. The 2026-07-20 row is FUTURE-dated relative to NOW and must
  // never appear in month counts, weekly buckets, or last-check-in reads.
  await prisma.attendance.createMany({
    data: [
      { gymId: GYM_ID, memberId: "an-m1", classDate: d("2026-07-07T18:00:00"), classType: "gi", locationSlug: "main" },
      { gymId: GYM_ID, memberId: "an-m1", classDate: d("2026-07-14T18:00:00"), classType: "gi", locationSlug: "main" },
      { gymId: GYM_ID, memberId: "an-m1", classDate: d("2026-06-30T18:00:00"), classType: "nogi", locationSlug: "main" },
      { gymId: GYM_ID, memberId: "an-m1", classDate: d("2026-07-20T18:00:00"), classType: "gi", locationSlug: "main" },
      { gymId: GYM_ID, memberId: "an-m2", classDate: d("2026-06-10T18:00:00"), classType: "gi", locationSlug: "main" },
      { gymId: GYM_ID, memberId: "an-m6", classDate: NOW_MINUS_30D, classType: "gi", locationSlug: "main" },
    ],
  });
}, 30_000);

afterAll(async () => {
  if (prisma && dbUp) await prisma.gym.deleteMany({ where: { id: GYM_ID } });
  await prisma?.$disconnect();
});

describe.skipIf(!url)("owner analytics metrics (real Postgres fixtures)", () => {
  it("Basic: counts, month boundaries, session average, future exclusion", async () => {
    expect(dbUp, "real-Postgres setup must have run").toBe(true);
    const b = await getBasicAnalytics(prisma!, GYM_ID, NOW);
    expect(b.totalMembers).toBe(5); // m3 inactive excluded
    expect(b.newThisMonth).toBe(2); // m2 + m4 (July, before NOW)
    expect(b.newLastMonth).toBe(1); // m1 (June)
    expect(b.attendanceThisMonth).toBe(2); // Jul 7 + Jul 14; FUTURE Jul 20 excluded
    expect(b.attendanceLastMonth).toBe(3); // Jun 30 + Jun 10 + Jun 15 boundary row
    expect(b.classSessionsThisMonth).toBe(2); // (Jul 7, gi) + (Jul 14, gi)
    expect(b.avgCheckinsPerSession).toBe(1); // 2 check-ins / 2 sessions — labeled plainly
    expect(b.beltDistribution).toEqual([
      { belt: "white", count: 4 }, // m2, m4, m5, m6
      { belt: "blue", count: 1 },
      { belt: "purple", count: 0 }, // m3 inactive
      { belt: "brown", count: 0 },
      { belt: "black", count: 0 },
    ]);
    expect(b.topClasses).toEqual([{ classType: "gi", count: 2 }]); // July only, no future
  });

  it("Pro: weekly buckets exclude future rows; risk honors creation-age and exact-cutoff boundaries", async () => {
    expect(dbUp, "real-Postgres setup must have run").toBe(true);
    const p = await getProAnalytics(prisma!, GYM_ID, NOW, { weeks: 4, months: 3 });

    expect(p.weeklyAttendance).toHaveLength(4);
    const total = p.weeklyAttendance.reduce((s, w) => s + w.count, 0);
    // Window = Mon Jun 22 .. NOW: Jun 30 + Jul 7 + Jul 14. The Jun 15 boundary
    // row predates the window; the FUTURE Jul 20 row is excluded by lte-now.
    expect(total).toBe(3);
    expect(p.weeklyAttendance[3].count).toBe(1); // current week (Jul 13-19): Jul 14 only

    expect(p.memberGrowth).toEqual([
      { month: "2026-05", count: 1 }, // m3 (record creations, any status)
      { month: "2026-06", count: 1 }, // m1
      { month: "2026-07", count: 2 }, // m2 + m4
    ]);

    // Corrected risk rules:
    //  - m5 (never attended, 3+ months old)     -> AT RISK (null)
    //  - m2 (last Jun 10, strictly > 30d ago)   -> AT RISK
    //  - m4 (never attended, only 10 days old)  -> NOT at risk
    //  - m6 (check-in EXACTLY at the cutoff)    -> NOT at risk (boundary)
    //  - m1 (trains currently; future row never counts as a check-in) -> not at risk
    expect(p.inactivityRisk.map((r) => [r.name, r.lastCheckIn])).toEqual([
      ["Eve Five", null],
      ["Bob Two", "2026-06-10"],
    ]);
  });
});
