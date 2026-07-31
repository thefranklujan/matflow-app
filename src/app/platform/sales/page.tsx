export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { SYNTHETIC_GYM_IDS } from "@/lib/founder-metrics";
import { RECENT_ATTENDANCE_DAYS, buildSalesQueueRow, type SalesQueueInput } from "@/lib/sales-queue";
import SalesQueueClient from "./SalesQueueClient";

/**
 * Founder sales / onboarding queue.
 *
 * Authorization is enforced server-side by the platform layout (platform-admin
 * email allow-list). All academy data is derived HERE on the server and only
 * the derived rows reach the browser — no unscoped customer records are shipped
 * to client code.
 */
export default async function SalesQueuePage() {
  const now = new Date();
  const recentSince = new Date(now.getTime() - RECENT_ATTENDANCE_DAYS * 24 * 60 * 60 * 1000);

  const gyms = await prisma.gym.findMany({
    where: { id: { notIn: SYNTHETIC_GYM_IDS } },
    select: {
      id: true,
      name: true,
      slug: true,
      createdAt: true,
      description: true,
      city: true,
      state: true,
      subscriptionStatus: true,
      stripePriceId: true,
      trialEndsAt: true,
      // The academy owner is the FIRST member by createdAt — never an
      // arbitrary member. When this comes back empty the owner is Unknown.
      members: {
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { firstName: true, lastName: true, email: true, phone: true },
      },
      _count: {
        select: {
          members: { where: { active: true, approved: true } },
          instructors: { where: { active: true } },
          classSchedules: { where: { active: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const gymIds = gyms.map((g) => g.id);

  const [recentAttendance, totalAttendance, latestActivity] = await Promise.all([
    prisma.attendance.groupBy({
      by: ["gymId"],
      where: { gymId: { in: gymIds }, classDate: { gte: recentSince } },
      _count: { _all: true },
    }),
    // Attendance has no Gym relation in the schema, so totals come from a
    // grouped count rather than a _count include.
    prisma.attendance.groupBy({
      by: ["gymId"],
      where: { gymId: { in: gymIds } },
      _count: { _all: true },
    }),
    prisma.activityLog.findMany({
      where: { gymId: { in: gymIds } },
      orderBy: { createdAt: "desc" },
      select: { gymId: true, action: true, createdAt: true },
      take: 500,
    }),
  ]);

  const recentByGym = new Map(recentAttendance.map((r) => [r.gymId, r._count._all]));
  const totalByGym = new Map(totalAttendance.map((r) => [r.gymId, r._count._all]));
  const lastActivityByGym = new Map<string, { action: string; createdAt: Date }>();
  for (const entry of latestActivity) {
    if (!lastActivityByGym.has(entry.gymId)) {
      lastActivityByGym.set(entry.gymId, { action: entry.action, createdAt: entry.createdAt });
    }
  }

  const rows = gyms.map((gym) => {
    const input: SalesQueueInput = {
      gymId: gym.id,
      gymName: gym.name,
      gymSlug: gym.slug,
      createdAt: gym.createdAt,
      subscriptionStatus: gym.subscriptionStatus,
      stripePriceId: gym.stripePriceId,
      trialEndsAt: gym.trialEndsAt,
      owner: gym.members[0] ?? null,
      facts: {
        description: gym.description,
        city: gym.city,
        state: gym.state,
        activeMemberCount: gym._count.members,
        activeInstructorCount: gym._count.instructors,
        activeScheduleCount: gym._count.classSchedules,
        attendanceCount: totalByGym.get(gym.id) ?? 0,
      },
      recentAttendanceCount: recentByGym.get(gym.id) ?? 0,
      lastActivity: lastActivityByGym.get(gym.id) ?? null,
    };
    return buildSalesQueueRow(input, now);
  });

  return <SalesQueueClient rows={rows} recentDays={RECENT_ATTENDANCE_DAYS} />;
}
