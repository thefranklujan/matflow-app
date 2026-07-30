/**
 * Class-occurrence window policy for student self-check-in — the single
 * server-side home for all "today"/window calculations.
 *
 * Policy: a class is eligible for self-check-in from 60 minutes before its
 * scheduled start until 60 minutes after its scheduled end, evaluated in the
 * ACADEMY's IANA timezone (Gym.timezone) — never the server's local zone and
 * never the device's zone.
 *
 * Timezone handling delegates entirely to the platform's ICU tables via
 * Intl.DateTimeFormat (built into Node and every supported browser). That is
 * the "reliable timezone library" here: DST shifts are resolved by ICU, and
 * this module only ever reasons about the WALL-CLOCK day-of-week and
 * minute-of-day that ICU reports — it never hand-rolls UTC-offset math.
 *
 * Midnight-crossing classes (endTime < startTime, e.g. 23:00–00:30) and
 * windows that spill across a day boundary (e.g. a 00:15 class whose window
 * opens 23:15 the previous day) are handled explicitly.
 */

export const CHECK_IN_OPENS_BEFORE_MIN = 60;
export const CHECK_IN_CLOSES_AFTER_MIN = 60;

export interface ScheduleSlot {
  id: string;
  dayOfWeek: number; // 0 = Sunday … 6 = Saturday (matches ClassSchedule)
  startTime: string; // "HH:MM" academy-local
  endTime: string; // "HH:MM" academy-local
  classType: string;
  instructor: string;
  instructorId?: string | null;
  locationSlug: string;
}

export interface EligibleOccurrence {
  scheduleId: string;
  classType: string;
  instructor: string;
  locationSlug: string;
  startTime: string;
  endTime: string;
  /** The academy-local calendar date of the class START, at UTC midnight —
   *  the same day-granular convention the kiosk and admin attendance use. */
  classDate: Date;
  /** Signed minutes from the scheduled start (negative = class not started). */
  minutesFromStart: number;
}

interface LocalNow {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  dayOfWeek: number; // 0-6, Sunday = 0
  minutes: number; // minute of the local day, 0-1439
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** The academy-local wall clock for an instant, via ICU (DST-safe). */
export function gymLocalNow(now: Date, timeZone: string): LocalNow {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    weekday: "short",
    hour12: false,
  });
  const parts: Record<string, string> = {};
  for (const p of fmt.formatToParts(now)) parts[p.type] = p.value;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    dayOfWeek: WEEKDAYS.indexOf(parts.weekday),
    // ICU may report hour 24 for midnight in some locales; normalize.
    minutes: (Number(parts.hour) % 24) * 60 + Number(parts.minute),
  };
}

function parseHHMM(value: string): number | null {
  const m = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

/** UTC-midnight Date for a local calendar date shifted by deltaDays. */
function localDateUtcMidnight(local: LocalNow, deltaDays: number): Date {
  return new Date(Date.UTC(local.year, local.month - 1, local.day + deltaDays));
}

/**
 * Evaluate one schedule slot against "now" in the academy's timezone.
 * Returns the occurrence when now is inside [start-60m, end+60m], else null.
 *
 * The check runs on the wall-clock timeline: for each candidate occurrence
 * day (the slot's dayOfWeek), the window is [start-60, endAdj+60] minutes
 * where endAdj = end (+1440 when the class crosses midnight). "now" can fall
 * into that window on the occurrence day itself, on the PREVIOUS local day
 * (window opens before midnight relative to a very early class — window
 * start < 0), or on the NEXT local day (window closes after midnight —
 * window end >= 1440).
 */
export function occurrenceForSlot(slot: ScheduleSlot, now: Date, timeZone: string): EligibleOccurrence | null {
  const start = parseHHMM(slot.startTime);
  const end = parseHHMM(slot.endTime);
  if (start === null || end === null) return null;

  const local = gymLocalNow(now, timeZone);
  const endAdj = end >= start ? end : end + 1440; // midnight-crossing class
  const windowStart = start - CHECK_IN_OPENS_BEFORE_MIN;
  const windowEnd = endAdj + CHECK_IN_CLOSES_AFTER_MIN;

  // deltaDays = occurrence day relative to the local "today".
  for (const deltaDays of [-1, 0, 1]) {
    // What day-of-week is the candidate occurrence day?
    const candidateDow = (((local.dayOfWeek + deltaDays) % 7) + 7) % 7;
    if (candidateDow !== slot.dayOfWeek) continue;
    // "now" expressed on the candidate day's minute axis.
    const nowOnCandidateAxis = local.minutes - deltaDays * 1440;
    if (nowOnCandidateAxis >= windowStart && nowOnCandidateAxis <= windowEnd) {
      return {
        scheduleId: slot.id,
        classType: slot.classType,
        instructor: slot.instructor,
        locationSlug: slot.locationSlug,
        startTime: slot.startTime,
        endTime: slot.endTime,
        classDate: localDateUtcMidnight(local, deltaDays),
        minutesFromStart: nowOnCandidateAxis - start,
      };
    }
  }
  return null;
}

/** All currently-eligible occurrences, nearest scheduled start first. */
export function eligibleClassesNow(slots: ScheduleSlot[], now: Date, timeZone: string): EligibleOccurrence[] {
  return slots
    .map((slot) => occurrenceForSlot(slot, now, timeZone))
    .filter((occ): occ is EligibleOccurrence => occ !== null)
    .sort((a, b) => Math.abs(a.minutesFromStart) - Math.abs(b.minutesFromStart));
}
