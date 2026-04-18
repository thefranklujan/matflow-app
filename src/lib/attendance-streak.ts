/**
 * Attendance streak helpers + milestone push notifications.
 *
 * "Streak" = number of consecutive distinct training days, where
 * consecutive means the next training day is no more than 7 days after
 * the previous one. (Most students train 2-4 days per week with
 * 1-3 day gaps; using a strict day-by-day streak would be unrealistic
 * for a sport this physical.)
 *
 * Fires `attendance_streak` notification when the streak length crosses
 * one of these milestones for the first time after a check-in: 5, 10,
 * 25, 50, 100. Idempotent against the in-memory streak — calling for a
 * member whose streak is already at the milestone doesn't re-notify.
 */

import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/push";

const MILESTONES = [5, 10, 25, 50, 100] as const;
const MAX_GAP_DAYS = 7;

function dateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  const ms = new Date(b + "T00:00:00Z").getTime() - new Date(a + "T00:00:00Z").getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

/** Compute current streak length from a list of attendance dates (any order). */
export function computeStreak(dates: Date[]): number {
  if (dates.length === 0) return 0;
  // Distinct sorted (most recent first)
  const distinct = Array.from(new Set(dates.map(dateOnly))).sort((a, b) => b.localeCompare(a));
  let streak = 1;
  for (let i = 0; i < distinct.length - 1; i++) {
    const gap = daysBetween(distinct[i + 1], distinct[i]);
    if (gap <= MAX_GAP_DAYS) streak++;
    else break;
  }
  return streak;
}

/** Find the milestone the streak crossed on its most recent +1 increment.
 * If the streak hits 5 exactly, returns 5. If it hits 10 exactly, returns 10.
 * Otherwise null. */
function milestoneCrossed(streak: number, prevStreak: number): number | null {
  for (const m of MILESTONES) {
    if (prevStreak < m && streak >= m) return m;
  }
  return null;
}

interface MaybeNotifyOpts {
  memberId: string;
  gymId: string;
}

/** Recompute streak for one member and notify if they just crossed a
 * milestone. Best-effort — never throws. */
export async function maybeNotifyStreakMilestone({ memberId, gymId }: MaybeNotifyOpts): Promise<void> {
  try {
    const member = await prisma.member.findFirst({
      where: { id: memberId, gymId },
      select: { id: true, studentId: true, firstName: true },
    });
    if (!member?.studentId) return;

    const attendances = await prisma.attendance.findMany({
      where: { memberId, gymId },
      select: { classDate: true },
      orderBy: { classDate: "desc" },
      take: 200, // 100 milestone is the max we care about; 200 covers gaps comfortably
    });
    if (attendances.length === 0) return;

    const dates = attendances.map((a) => a.classDate);
    const streak = computeStreak(dates);

    // Compute the streak as it was before this most-recent training day so
    // we can detect milestone crossings instead of resending every time.
    const prevDates = dates.slice(1);
    const prevStreak = computeStreak(prevDates);
    const crossed = milestoneCrossed(streak, prevStreak);
    if (!crossed) return;

    await notify({
      externalIds: [`student-${member.studentId}`],
      kind: "attendance_streak",
      title: `🔥 ${crossed}-class streak!`,
      body: `${crossed} classes in a row. Keep it going.`,
      url: "/student",
      gymId,
    });
  } catch (e) {
    console.error("[attendance_streak] failed for member", memberId, e);
  }
}

/** Run streak checks for many members in parallel (capped concurrency). */
export async function notifyStreakMilestonesForMembers(
  memberIds: string[],
  gymId: string
): Promise<void> {
  const BATCH = 8;
  for (let i = 0; i < memberIds.length; i += BATCH) {
    await Promise.all(
      memberIds.slice(i, i + BATCH).map((memberId) =>
        maybeNotifyStreakMilestone({ memberId, gymId })
      )
    );
  }
}
