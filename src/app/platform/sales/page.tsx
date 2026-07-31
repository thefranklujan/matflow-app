export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { SYNTHETIC_GYM_IDS } from "@/lib/founder-metrics";
import { OWNER_MARKER_PREFIX, RECENT_ATTENDANCE_DAYS, buildSalesQueueRow, type SalesQueueInput } from "@/lib/sales-queue";
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
      // Owners are identified ONLY by the registration marker. Take a few so
      // ambiguity (more than one marked owner) is detectable; clerkUserId is
      // used for resolution here on the server and never sent to the browser.
      members: {
        where: { clerkUserId: { startsWith: OWNER_MARKER_PREFIX } },
        take: 5,
        select: { clerkUserId: true, firstName: true, lastName: true, email: true, phone: true },
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

  // Latest activity per academy: a grouped max avoids both the old global
  // take:500 window (which one busy academy could consume) and an N+1 query.
  let latestByGym = new Map<string, { action: string; createdAt: Date }>();
  let activityUnavailable = false;
  const loadLatestActivity = async () => {
    const maxima = await prisma.activityLog.groupBy({
      by: ["gymId"],
      where: { gymId: { in: gymIds } },
      _max: { createdAt: true },
    });
    const pairs = maxima.filter((m) => m._max.createdAt !== null);
    if (pairs.length === 0) return;
    // Fetch only the rows AT each academy's maximum timestamp, then pick one
    // deterministically when several share the same instant.
    const rows = await prisma.activityLog.findMany({
      where: { OR: pairs.map((m) => ({ gymId: m.gymId, createdAt: m._max.createdAt as Date })) },
      select: { gymId: true, action: true, createdAt: true, id: true },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    });
    const next = new Map<string, { action: string; createdAt: Date }>();
    for (const row of rows) {
      if (!next.has(row.gymId)) next.set(row.gymId, { action: row.action, createdAt: row.createdAt });
    }
    latestByGym = next;
  };

  const [recentAttendance, totalAttendance] = await Promise.all([
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
  ]);

  try {
    await loadLatestActivity();
  } catch (err) {
    // Never fabricate "no activity" from a failed read.
    console.error("sales queue: latest activity unavailable", { name: (err as { name?: string })?.name });
    activityUnavailable = true;
  }

  const recentByGym = new Map(recentAttendance.map((r) => [r.gymId, r._count._all]));
  const totalByGym = new Map(totalAttendance.map((r) => [r.gymId, r._count._all]));

  const rows = gyms.map((gym) => {
    const input: SalesQueueInput = {
      gymId: gym.id,
      gymName: gym.name,
      gymSlug: gym.slug,
      createdAt: gym.createdAt,
      subscriptionStatus: gym.subscriptionStatus,
      stripePriceId: gym.stripePriceId,
      trialEndsAt: gym.trialEndsAt,
      ownerCandidates: gym.members,
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
      lastActivity: latestByGym.get(gym.id) ?? null,
      lastActivityUnavailable: activityUnavailable,
    };
    return buildSalesQueueRow(input, now);
  });

  return <SalesQueueClient rows={rows} recentDays={RECENT_ATTENDANCE_DAYS} />;
}
