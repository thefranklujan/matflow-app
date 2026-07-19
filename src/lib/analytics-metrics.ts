import type { PrismaClient, Prisma } from "@prisma/client";

/**
 * Owner analytics, split along the SOLD boundary:
 * - Basic: active members, new members, current-month check-ins, belt
 *   distribution, top classes.
 * - Pro: multi-week attendance trend, member-growth trend, inactivity-risk
 *   report — all derivable from existing verified records.
 *
 * The page must ONLY call getProAnalytics for Pro-entitled gyms — Pro data is
 * never fetched and hidden client-side. `now` is injected so date boundaries
 * are testable; `db` is injected so fixtures run against the real local DB.
 */

export type Db = PrismaClient | Prisma.TransactionClient;

export interface BasicAnalytics {
  totalMembers: number;
  newThisMonth: number;
  newLastMonth: number;
  attendanceThisMonth: number;
  attendanceLastMonth: number;
  beltDistribution: { belt: string; count: number }[];
  topClasses: { classType: string; count: number }[];
}

export interface ProAnalytics {
  /** Check-ins per ISO week, oldest first, exactly `weeks` buckets. */
  weeklyAttendance: { weekStart: string; count: number }[];
  /** New members per calendar month, oldest first, exactly `months` buckets. */
  memberGrowth: { month: string; count: number }[];
  /** Active members with no check-in in the last 30 days (or ever). */
  inactivityRisk: { memberId: string; name: string; lastCheckIn: string | null }[];
}

const BELT_ORDER = ["white", "blue", "purple", "brown", "black"];

export async function getBasicAnalytics(db: Db, gymId: string, now: Date): Promise<BasicAnalytics> {
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [totalMembers, newThisMonth, newLastMonth, attendanceThisMonth, attendanceLastMonth, beltGroups, classGroups] =
    await Promise.all([
      db.member.count({ where: { gymId, active: true } }),
      db.member.count({ where: { gymId, createdAt: { gte: startOfMonth } } }),
      db.member.count({ where: { gymId, createdAt: { gte: startOfLastMonth, lt: startOfMonth } } }),
      db.attendance.count({ where: { gymId, classDate: { gte: startOfMonth } } }),
      db.attendance.count({ where: { gymId, classDate: { gte: startOfLastMonth, lt: startOfMonth } } }),
      db.member.groupBy({ by: ["beltRank"], where: { gymId, active: true }, _count: true }),
      db.attendance.groupBy({
        by: ["classType"],
        where: { gymId, classDate: { gte: startOfMonth } },
        _count: true,
        orderBy: { _count: { classType: "desc" } },
        take: 5,
      }),
    ]);

  return {
    totalMembers,
    newThisMonth,
    newLastMonth,
    attendanceThisMonth,
    attendanceLastMonth,
    beltDistribution: BELT_ORDER.map((belt) => ({
      belt,
      count: beltGroups.find((g) => g.beltRank === belt)?._count ?? 0,
    })),
    topClasses: classGroups.map((g) => ({ classType: g.classType, count: g._count })),
  };
}

/** Monday 00:00 of the week containing `d` (local time). */
function weekStartOf(d: Date): Date {
  const day = (d.getDay() + 6) % 7; // Mon=0..Sun=6
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
  return start;
}

export async function getProAnalytics(
  db: Db,
  gymId: string,
  now: Date,
  { weeks = 8, months = 6 }: { weeks?: number; months?: number } = {},
): Promise<ProAnalytics> {
  const currentWeekStart = weekStartOf(now);
  const firstWeekStart = new Date(currentWeekStart);
  firstWeekStart.setDate(firstWeekStart.getDate() - 7 * (weeks - 1));
  const firstMonthStart = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
  const inactivityCutoff = new Date(now.getTime() - 30 * 24 * 3600 * 1000);

  const [attendanceRows, memberRows, activeMembers, lastCheckIns] = await Promise.all([
    db.attendance.findMany({
      where: { gymId, classDate: { gte: firstWeekStart } },
      select: { classDate: true },
    }),
    db.member.findMany({
      where: { gymId, createdAt: { gte: firstMonthStart } },
      select: { createdAt: true },
    }),
    db.member.findMany({
      where: { gymId, active: true },
      select: { id: true, firstName: true, lastName: true },
    }),
    db.attendance.groupBy({
      by: ["memberId"],
      where: { gymId },
      _max: { classDate: true },
    }),
  ]);

  // Weekly buckets, oldest first.
  const weeklyAttendance: { weekStart: string; count: number }[] = [];
  for (let i = 0; i < weeks; i++) {
    const start = new Date(firstWeekStart);
    start.setDate(start.getDate() + 7 * i);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    weeklyAttendance.push({
      weekStart: start.toISOString().slice(0, 10),
      count: attendanceRows.filter((a) => a.classDate >= start && a.classDate < end).length,
    });
  }

  // Monthly member-growth buckets, oldest first.
  const memberGrowth: { month: string; count: number }[] = [];
  for (let i = 0; i < months; i++) {
    const start = new Date(now.getFullYear(), now.getMonth() - (months - 1) + i, 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    memberGrowth.push({
      month: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`,
      count: memberRows.filter((m) => m.createdAt >= start && m.createdAt < end).length,
    });
  }

  // Inactivity risk: active members whose latest check-in is older than 30
  // days, or who never checked in.
  const lastByMember = new Map(lastCheckIns.map((g) => [g.memberId, g._max.classDate]));
  const inactivityRisk = activeMembers
    .map((m) => ({ member: m, last: lastByMember.get(m.id) ?? null }))
    .filter(({ last }) => !last || last < inactivityCutoff)
    .map(({ member, last }) => ({
      memberId: member.id,
      name: `${member.firstName} ${member.lastName}`,
      lastCheckIn: last ? last.toISOString().slice(0, 10) : null,
    }))
    .sort((a, b) => (a.lastCheckIn ?? "") < (b.lastCheckIn ?? "") ? -1 : 1);

  return { weeklyAttendance, memberGrowth, inactivityRisk };
}
