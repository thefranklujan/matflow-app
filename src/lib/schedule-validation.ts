/**
 * Server-authoritative validation for academy class schedule entries.
 *
 * Pure: no DB access, no auth. The route applies tenancy checks (instructor
 * ownership) separately, because that requires a query.
 *
 * A class MAY cross midnight (e.g. 23:00–00:30), so endTime < startTime is
 * valid; only an identical start and end is rejected.
 */

export const MAX_CLASS_TYPE = 60;
export const MAX_INSTRUCTOR = 80;
export const MAX_TOPIC = 200;
export const MAX_LOCATION_SLUG = 60;

export interface ScheduleInput {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  classType: string;
  instructor: string;
  instructorId: string | null;
  locationSlug: string;
  topic: string | null;
}

export type ScheduleValidationError = {
  field: string;
  code: string;
  message: string;
};

export type ScheduleValidationResult =
  | { ok: true; value: ScheduleInput }
  | { ok: false; error: ScheduleValidationError };

const HHMM = /^([01][0-9]|2[0-3]):([0-5][0-9])$/;

/** Strict HH:mm (24-hour, zero-padded). */
export function isValidHHMM(value: unknown): value is string {
  return typeof value === "string" && HHMM.test(value);
}

function fail(field: string, code: string, message: string): ScheduleValidationResult {
  return { ok: false, error: { field, code, message } };
}

function trimmedString(value: unknown): string | null {
  return typeof value === "string" ? value.trim() : null;
}

export function validateScheduleInput(body: unknown): ScheduleValidationResult {
  if (typeof body !== "object" || body === null) {
    return fail("body", "INVALID_BODY", "Request body must be an object.");
  }
  const input = body as Record<string, unknown>;

  // dayOfWeek: integer 0-6 (Sunday..Saturday)
  const dayOfWeek = input.dayOfWeek;
  if (typeof dayOfWeek !== "number" || !Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    return fail("dayOfWeek", "INVALID_DAY", "Pick a day of the week.");
  }

  if (!isValidHHMM(input.startTime)) {
    return fail("startTime", "INVALID_START_TIME", "Start time must be a 24-hour time like 18:00.");
  }
  if (!isValidHHMM(input.endTime)) {
    return fail("endTime", "INVALID_END_TIME", "End time must be a 24-hour time like 19:30.");
  }
  if (input.startTime === input.endTime) {
    // A class crossing midnight is fine; a zero-length class is not.
    return fail("endTime", "EQUAL_TIMES", "End time must be different from the start time.");
  }

  const classType = trimmedString(input.classType);
  if (!classType) {
    return fail("classType", "REQUIRED", "Class type is required.");
  }
  if (classType.length > MAX_CLASS_TYPE) {
    return fail("classType", "TOO_LONG", `Class type must be ${MAX_CLASS_TYPE} characters or fewer.`);
  }

  const instructor = trimmedString(input.instructor);
  if (!instructor) {
    return fail("instructor", "REQUIRED", "Instructor is required.");
  }
  if (instructor.length > MAX_INSTRUCTOR) {
    return fail("instructor", "TOO_LONG", `Instructor must be ${MAX_INSTRUCTOR} characters or fewer.`);
  }

  const topicRaw = input.topic;
  let topic: string | null = null;
  if (topicRaw !== undefined && topicRaw !== null && topicRaw !== "") {
    const trimmed = trimmedString(topicRaw);
    if (trimmed === null) {
      return fail("topic", "INVALID", "Topic must be text.");
    }
    if (trimmed.length > MAX_TOPIC) {
      return fail("topic", "TOO_LONG", `Topic must be ${MAX_TOPIC} characters or fewer.`);
    }
    topic = trimmed || null;
  }

  const locationRaw = input.locationSlug;
  let locationSlug = "main";
  if (locationRaw !== undefined && locationRaw !== null && locationRaw !== "") {
    const trimmed = trimmedString(locationRaw);
    if (trimmed === null) {
      return fail("locationSlug", "INVALID", "Location must be text.");
    }
    if (trimmed.length > MAX_LOCATION_SLUG) {
      return fail("locationSlug", "TOO_LONG", `Location must be ${MAX_LOCATION_SLUG} characters or fewer.`);
    }
    if (!/^[a-z0-9][a-z0-9-]*$/i.test(trimmed)) {
      return fail("locationSlug", "INVALID", "Location may use letters, numbers, and hyphens only.");
    }
    locationSlug = trimmed;
  }

  const instructorIdRaw = input.instructorId;
  let instructorId: string | null = null;
  if (instructorIdRaw !== undefined && instructorIdRaw !== null && instructorIdRaw !== "") {
    if (typeof instructorIdRaw !== "string" || instructorIdRaw.length > 64) {
      return fail("instructorId", "INVALID", "Instructor selection is not valid.");
    }
    instructorId = instructorIdRaw;
  }

  return {
    ok: true,
    value: {
      dayOfWeek,
      startTime: input.startTime,
      endTime: input.endTime,
      classType,
      instructor,
      instructorId,
      locationSlug,
      topic,
    },
  };
}
