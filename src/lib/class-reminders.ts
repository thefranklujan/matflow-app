import { prisma } from "@/lib/prisma";
import { absolutize, sendBulkPush } from "@/lib/push";
import { gymLocalNow, type ScheduleSlot } from "@/lib/class-window";
import { commitmentDateKey, commitmentKey, dateFromKey, resolveCommitment } from "@/lib/class-commitment";

/**
 * Class reminder job (driven by /api/cron/class-reminders every 5 minutes).
 *
 * For each ACTIVE class whose start is 15–19 minutes away in its academy's
 * timezone, remind the students whose commitment resolves to THAT dated
 * occurrence (src/lib/class-commitment.ts) and whose membership is still
 * active and approved.
 *
 * Duplicate suppression is durable, not in-process: the Notification inbox
 * row (kind "class_reminder", url unique per occurrence, externalId) is the
 * record that a reminder was issued. Each occurrence is processed under a
 * transaction-scoped advisory lock, so overlapping or retried cron
 * invocations insert at most one row per student per occurrence, and push is
 * attempted only for rows inserted by this invocation.
 *
 * Delivery semantics: at most one push ATTEMPT per student per occurrence
 * from this job. The provider (OneSignal) accepting a request is not proof of
 * delivery or of reading, and a provider timeout after the row commits is not
 * retried (no duplicate), so a reminder can be missed but not doubled.
 * Device-level push opt-out is enforced by the provider subscription; there
 * is no per-category preference in the schema yet.
 */

export const REMINDER_WINDOW_MIN = 15;
export const REMINDER_WINDOW_MAX = 19;

function hhmm(v: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(v);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

function localDateKey(now: Date, tz: string, deltaDays = 0) {
  const l = gymLocalNow(now, tz);
  return new Date(Date.UTC(l.year, l.month - 1, l.day + deltaDays)).toISOString().slice(0, 10);
}

/**
 * The academy-local date of the occurrence starting 15–19 minutes from now,
 * or null. Checks today and tomorrow so a 00:10 class is reminded at 23:5x
 * the previous evening.
 */
function dueOccurrenceDate(c: { dayOfWeek: number; startTime: string }, now: Date, tz: string): string | null {
  const start = hhmm(c.startTime);
  if (start === null) return null;
  const local = gymLocalNow(now, tz);
  for (const delta of [0, 1]) {
    if (c.dayOfWeek !== (local.dayOfWeek + delta) % 7) continue;
    const minsUntil = start + delta * 1440 - local.minutes;
    if (minsUntil >= REMINDER_WINDOW_MIN && minsUntil <= REMINDER_WINDOW_MAX) return localDateKey(now, tz, delta);
  }
  return null;
}

export function reminderUrl(gymId: string, scheduleId: string, dateKey: string) {
  return `/student/academy?gym=${encodeURIComponent(gymId)}&class=${encodeURIComponent(scheduleId)}&date=${dateKey}`;
}

export interface ReminderRunResult {
  classesProcessed: number;
  notified: number;
  alreadyReminded: number;
  ambiguousLegacy: number;
  skippedInactiveMembers: number;
}

export async function runClassReminders(now: Date): Promise<ReminderRunResult> {
  const result: ReminderRunResult = {
    classesProcessed: 0,
    notified: 0,
    alreadyReminded: 0,
    ambiguousLegacy: 0,
    skippedInactiveMembers: 0,
  };

  const allActive = await prisma.classSchedule.findMany({
    where: { active: true },
    include: { gym: { select: { id: true, name: true, timezone: true } } },
  });

  const due = allActive
    .map((c) => ({ cls: c, dateKey: dueOccurrenceDate(c, now, c.gym.timezone || "America/Chicago") }))
    .filter((d): d is { cls: (typeof allActive)[number]; dateKey: string } => d.dateKey !== null);

  for (const { cls, dateKey } of due) {
    result.classesProcessed++;
    const tz = cls.gym.timezone || "America/Chicago";
    const dayStart = dateFromKey(dateKey)!;
    const slots: ScheduleSlot[] = allActive.filter((s) => s.gymId === cls.gymId);

    // Candidate rows: canonical UTC-midnight dates plus legacy browser-local
    // midnights (±14h); resolveCommitment then decides the exact occurrence.
    const commitments = await prisma.scheduleCommitment.findMany({
      where: {
        gymId: cls.gymId,
        locationSlug: cls.locationSlug,
        classType: { in: [commitmentKey(cls.classType, cls.startTime), cls.classType] },
        classDate: {
          gte: new Date(dayStart.getTime() - 14 * 3600_000),
          lt: new Date(dayStart.getTime() + 38 * 3600_000),
        },
      },
      include: { member: { select: { studentId: true, active: true, approved: true, gymId: true } } },
    });

    const studentIds = new Set<string>();
    for (const c of commitments) {
      if (commitmentDateKey(c.classDate, tz) !== dateKey) continue;
      const r = resolveCommitment(c, slots, tz);
      if (r.status === "ambiguous") {
        result.ambiguousLegacy++;
        continue;
      }
      if (r.status !== "resolved" || r.scheduleId !== cls.id) continue;
      if (!c.member.active || !c.member.approved || c.member.gymId !== cls.gymId) {
        result.skippedInactiveMembers++;
        continue;
      }
      if (c.member.studentId) studentIds.add(c.member.studentId);
    }
    if (studentIds.size === 0) continue;

    const url = reminderUrl(cls.gymId, cls.id, dateKey);
    const externalIds = Array.from(studentIds).map((sid) => `student-${sid}`);
    const title = `${cls.classType} starts in 15 min`;
    const body = cls.instructor
      ? `${cls.gym.name} with ${cls.instructor}. Tap to see the class.`
      : `${cls.gym.name}. Tap to see the class.`;

    const fresh = await prisma.$transaction(async (tx) => {
      const lockKey = `class-reminder:${cls.id}:${dateKey}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
      const existing = await tx.notification.findMany({
        where: { kind: "class_reminder", url, externalId: { in: externalIds } },
        select: { externalId: true },
      });
      const seen = new Set(existing.map((e) => e.externalId));
      const toSend = externalIds.filter((id) => !seen.has(id));
      if (toSend.length) {
        await tx.notification.createMany({
          data: toSend.map((externalId) => ({
            externalId,
            gymId: cls.gymId,
            kind: "class_reminder",
            title,
            body,
            url,
          })),
        });
      }
      return { toSend, skipped: seen.size };
    });

    result.alreadyReminded += fresh.skipped;
    if (fresh.toSend.length === 0) continue;
    await sendBulkPush({
      externalIds: fresh.toSend,
      title,
      body,
      url: absolutize(url),
      data: { kind: "class_reminder", gymId: cls.gymId, path: url },
    });
    result.notified += fresh.toSend.length;
  }

  return result;
}
