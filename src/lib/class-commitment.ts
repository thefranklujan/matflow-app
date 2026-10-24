import { gymLocalNow, upcomingOccurrences, type ScheduleSlot } from "@/lib/class-window";

/**
 * Academy class-occurrence commitment contract ("I'm going"), shared by every
 * writer (owner/member schedule, student Academy view) and reader (calendar,
 * reminder cron). Uses the existing ScheduleCommitment table — no schema
 * change.
 *
 * Identity of one occurrence = gym + academy-local date + class type + start
 * time + location:
 *   - classDate    UTC midnight of the ACADEMY-LOCAL calendar date
 *   - classType    "<classType>@<HH:MM>" (composite key the schedule UI
 *                  already writes, so two same-type classes on one day stay
 *                  separate)
 *   - locationSlug the schedule's location
 *
 * Legacy rows are read without guessing:
 *   - a raw classType with no "@HH:MM" resolves only when exactly one active
 *     class of that type/location runs that day; otherwise it is AMBIGUOUS
 *     and excluded from reminders (and counted, so it is visible);
 *   - a classDate that is not UTC midnight was written as browser-local
 *     midnight; its date is read in the academy's timezone.
 *
 * A commitment is intent, never attendance: nothing here creates or implies
 * an Attendance row. Personal weekly training plans (StudentTrainingPlan)
 * are a different concept and are never converted into commitments.
 */

export const COMMIT_HORIZON_DAYS = 14;

export function commitmentKey(classType: string, startTime: string): string {
  return `${classType}@${startTime}`;
}

export function parseCommitmentKey(raw: string): { classType: string; startTime: string | null } {
  const m = raw.match(/^(.*)@(\d{1,2}:\d{2})$/);
  return m ? { classType: m[1], startTime: m[2] } : { classType: raw, startTime: null };
}

/** UTC-midnight Date for a "YYYY-MM-DD" key, or null when invalid. */
export function dateFromKey(key: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toISOString().slice(0, 10) === key ? d : null;
}

/** Academy-local "YYYY-MM-DD" a stored commitment refers to (see header). */
export function commitmentDateKey(classDate: Date, timeZone: string): string {
  const isUtcMidnight =
    classDate.getUTCHours() === 0 && classDate.getUTCMinutes() === 0 && classDate.getUTCSeconds() === 0;
  if (isUtcMidnight) return classDate.toISOString().slice(0, 10);
  const l = gymLocalNow(classDate, timeZone);
  return `${l.year}-${String(l.month).padStart(2, "0")}-${String(l.day).padStart(2, "0")}`;
}

/** Normalize a client-sent date ("YYYY-MM-DD" preferred, legacy ISO accepted). */
export function normalizeClassDate(input: unknown, timeZone: string): Date | null {
  if (typeof input !== "string" || !input) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return dateFromKey(input);
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return null;
  return dateFromKey(commitmentDateKey(parsed, timeZone));
}

export type Resolution =
  | { status: "resolved"; scheduleId: string }
  | { status: "ambiguous"; candidates: string[] }
  | { status: "unmatched" };

/**
 * Which scheduled class a stored commitment means. "unmatched" covers a
 * class that was canceled (inactive) or rescheduled to a different time.
 */
export function resolveCommitment(
  c: { classDate: Date; classType: string; locationSlug: string },
  slots: ScheduleSlot[],
  timeZone: string,
): Resolution {
  const key = commitmentDateKey(c.classDate, timeZone);
  const dow = new Date(`${key}T00:00:00Z`).getUTCDay();
  const { classType, startTime } = parseCommitmentKey(c.classType);
  const candidates = slots.filter(
    (s) =>
      s.dayOfWeek === dow &&
      s.classType === classType &&
      (!c.locationSlug || s.locationSlug === c.locationSlug) &&
      (startTime === null || s.startTime === startTime),
  );
  if (candidates.length === 1) return { status: "resolved", scheduleId: candidates[0].id };
  if (candidates.length === 0) return { status: "unmatched" };
  return { status: "ambiguous", candidates: candidates.map((s) => s.id) };
}

export class CommitmentError extends Error {
  constructor(public readonly code: "INVALID_OCCURRENCE" | "NOT_UPCOMING", message: string) {
    super(message);
    this.name = "CommitmentError";
  }
}

/**
 * Validate that (scheduleId, dateKey) is a real, not-yet-started occurrence
 * of an ACTIVE class at this academy within the commitment horizon, and
 * return the canonical row identity to store.
 */
export function occurrenceIdentity(
  slot: ScheduleSlot | null,
  dateKey: unknown,
  now: Date,
  timeZone: string,
): { classDate: Date; classType: string; locationSlug: string } {
  if (!slot || typeof dateKey !== "string" || !dateFromKey(dateKey)) {
    throw new CommitmentError("INVALID_OCCURRENCE", "That class is not on this academy's schedule.");
  }
  const upcoming = upcomingOccurrences([slot], now, timeZone, COMMIT_HORIZON_DAYS);
  const occ = upcoming.find((o) => o.dateKey === dateKey);
  if (!occ) {
    throw new CommitmentError("NOT_UPCOMING", "You can only mark upcoming classes in the next two weeks.");
  }
  return {
    classDate: occ.classDate,
    classType: commitmentKey(slot.classType, slot.startTime),
    locationSlug: slot.locationSlug,
  };
}
