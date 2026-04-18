export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/push";

/**
 * /api/cron/class-reminders
 *
 * Vercel cron-driven push notifier. Runs every 5 minutes (per vercel.json).
 *
 * For every gym:
 *   1. Look up today's ClassSchedule rows for the current weekday.
 *   2. For each scheduled class whose startTime is 15-19 minutes from now
 *      (the 5-minute window matches the cron cadence so we never double-fire),
 *      find every ScheduleCommitment for today + that class type.
 *   3. Send a `class_reminder` push to each committed member's linked student.
 *
 * The 15-19 min window means a class starting at 6:00 PM gets reminders
 * fired by the cron run at 5:45 PM (15 mins out) and not again at 5:50 PM
 * because that run sees it as 10 mins out.
 *
 * Auth: requires `Authorization: Bearer ${CRON_SECRET}` so only Vercel
 * Cron (and Frank's manual curl) can invoke it.
 */

const REMINDER_WINDOW_MIN = 15;
const REMINDER_WINDOW_MAX = 19;

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}

/** Get { dayOfWeek, minuteOfDay, todayYmd } in a specific IANA timezone. */
function nowInZone(zone: string): { dayOfWeek: number; minuteOfDay: number; todayYmd: string } {
  // weekday short ("Mon") + hour/minute, all formatted in the target zone.
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = dtf.formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dayOfWeek = weekdayMap[get("weekday")] ?? 0;
  const hour = Number(get("hour"));
  const minute = Number(get("minute"));
  // 24h formatter renders midnight as "24" in some envs — normalize.
  const minuteOfDay = (hour === 24 ? 0 : hour) * 60 + minute;
  const todayYmd = `${get("year")}-${get("month")}-${get("day")}`;
  return { dayOfWeek, minuteOfDay, todayYmd };
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Pull all active classes, then filter per gym timezone — each gym can be
  // in a different IANA zone, so the same UTC moment is a different local
  // hour/day-of-week per gym.
  const allActive = await prisma.classSchedule.findMany({
    where: { active: true },
    include: { gym: { select: { id: true, name: true, timezone: true } } },
  });

  const dueClasses = allActive.filter((c) => {
    const tz = c.gym.timezone || "America/Chicago";
    const { dayOfWeek, minuteOfDay } = nowInZone(tz);
    if (c.dayOfWeek !== dayOfWeek) return false;
    const startMin = timeToMinutes(c.startTime);
    const minsUntil = startMin - minuteOfDay;
    return minsUntil >= REMINDER_WINDOW_MIN && minsUntil < REMINDER_WINDOW_MAX + 1;
  });

  let notified = 0;
  let classesProcessed = 0;

  for (const cls of dueClasses) {
    classesProcessed++;
    const tz = cls.gym.timezone || "America/Chicago";
    const { todayYmd } = nowInZone(tz);
    // Use a date range covering the full local day in UTC. Commitments are
    // stored as UTC midnight of the local class date by the existing
    // commitment route, so range start/end at UTC midnight of that date.
    const dayStart = new Date(`${todayYmd}T00:00:00Z`);
    const dayEnd = new Date(dayStart.getTime() + 36 * 60 * 60 * 1000); // 36h window covers timezone offsets

    const commitments = await prisma.scheduleCommitment.findMany({
      where: {
        gymId: cls.gymId,
        classType: cls.classType,
        locationSlug: cls.locationSlug,
        classDate: { gte: dayStart, lt: dayEnd },
      },
      include: {
        member: { select: { studentId: true, firstName: true } },
      },
    });

    const recipients = commitments
      .map((c) => c.member.studentId)
      .filter((sid): sid is string => Boolean(sid))
      .map((sid) => `student-${sid}`);

    if (recipients.length === 0) continue;

    await notify({
      externalIds: recipients,
      kind: "class_reminder",
      title: `${cls.classType} starts in 15 min`,
      body: cls.instructor
        ? `${cls.gym.name} with ${cls.instructor}. Tap to see today's class.`
        : `${cls.gym.name}. Tap to see today's class.`,
      url: "/student",
      gymId: cls.gymId,
    });
    notified += recipients.length;
  }

  return NextResponse.json({
    success: true,
    classesProcessed,
    notified,
    windowMinutes: `${REMINDER_WINDOW_MIN}-${REMINDER_WINDOW_MAX}`,
  });
}
