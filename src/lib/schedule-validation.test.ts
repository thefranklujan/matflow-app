import { describe, it, expect } from "vitest";
import {
  MAX_CLASS_TYPE,
  MAX_INSTRUCTOR,
  MAX_LOCATION_SLUG,
  MAX_TOPIC,
  isValidHHMM,
  validateScheduleInput,
} from "./schedule-validation";

const valid = {
  dayOfWeek: 1,
  startTime: "18:00",
  endTime: "19:30",
  classType: "gi",
  instructor: "Prof. Silva",
};

function err(body: Record<string, unknown>) {
  const res = validateScheduleInput({ ...valid, ...body });
  expect(res.ok, JSON.stringify(body)).toBe(false);
  return res.ok ? null : res.error;
}

describe("isValidHHMM", () => {
  it("accepts zero-padded 24-hour times", () => {
    for (const t of ["00:00", "09:05", "18:00", "23:59"]) expect(isValidHHMM(t), t).toBe(true);
  });
  it("rejects malformed times", () => {
    for (const t of ["24:00", "23:60", "9:00", "18:0", "18", "18:00:00", "6pm", "", "  ", null, 1800]) {
      expect(isValidHHMM(t as string), String(t)).toBe(false);
    }
  });
});

describe("validateScheduleInput — happy paths", () => {
  it("accepts a normal class and trims text", () => {
    const res = validateScheduleInput({ ...valid, classType: "  gi  ", instructor: "  Prof. Silva  " });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.classType).toBe("gi");
      expect(res.value.instructor).toBe("Prof. Silva");
      expect(res.value.locationSlug).toBe("main"); // default
      expect(res.value.topic).toBeNull();
      expect(res.value.instructorId).toBeNull();
    }
  });

  it("allows a class that crosses midnight", () => {
    const res = validateScheduleInput({ ...valid, startTime: "23:00", endTime: "00:30" });
    expect(res.ok).toBe(true);
  });

  it("accepts every valid day boundary", () => {
    for (const day of [0, 1, 2, 3, 4, 5, 6]) {
      expect(validateScheduleInput({ ...valid, dayOfWeek: day }).ok, String(day)).toBe(true);
    }
  });

  it("accepts optional topic, location, and instructorId", () => {
    const res = validateScheduleInput({
      ...valid,
      topic: "  Guard passing  ",
      locationSlug: "annex-2",
      instructorId: "instr_123",
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.topic).toBe("Guard passing");
      expect(res.value.locationSlug).toBe("annex-2");
      expect(res.value.instructorId).toBe("instr_123");
    }
  });

  it("accepts maximum-length values", () => {
    const res = validateScheduleInput({
      ...valid,
      classType: "a".repeat(MAX_CLASS_TYPE),
      instructor: "b".repeat(MAX_INSTRUCTOR),
      topic: "c".repeat(MAX_TOPIC),
      locationSlug: "d".repeat(MAX_LOCATION_SLUG),
    });
    expect(res.ok).toBe(true);
  });
});

describe("validateScheduleInput — rejections", () => {
  it("rejects a non-object body", () => {
    for (const body of [null, undefined, "string", 42, []]) {
      const res = validateScheduleInput(body as unknown);
      // An array has no valid dayOfWeek, so it fails either way.
      expect(res.ok, String(body)).toBe(false);
    }
  });

  it("rejects out-of-range and non-integer days", () => {
    for (const day of [-1, 7, 1.5, NaN, Infinity, "1", null, undefined]) {
      expect(err({ dayOfWeek: day })?.code, String(day)).toBe("INVALID_DAY");
    }
  });

  it("rejects malformed times", () => {
    expect(err({ startTime: "9:00" })?.code).toBe("INVALID_START_TIME");
    expect(err({ startTime: "24:00" })?.code).toBe("INVALID_START_TIME");
    expect(err({ endTime: "19:60" })?.code).toBe("INVALID_END_TIME");
    expect(err({ endTime: "" })?.code).toBe("INVALID_END_TIME");
    expect(err({ startTime: null })?.code).toBe("INVALID_START_TIME");
  });

  it("rejects equal start and end", () => {
    const e = err({ startTime: "18:00", endTime: "18:00" });
    expect(e?.code).toBe("EQUAL_TIMES");
    expect(e?.field).toBe("endTime");
  });

  it("rejects missing or whitespace-only required text", () => {
    expect(err({ classType: "" })?.code).toBe("REQUIRED");
    expect(err({ classType: "   " })?.code).toBe("REQUIRED");
    expect(err({ classType: 5 })?.code).toBe("REQUIRED");
    expect(err({ instructor: "" })?.code).toBe("REQUIRED");
    expect(err({ instructor: " \t \n " })?.code).toBe("REQUIRED");
  });

  it("rejects over-length values", () => {
    expect(err({ classType: "a".repeat(MAX_CLASS_TYPE + 1) })?.code).toBe("TOO_LONG");
    expect(err({ instructor: "b".repeat(MAX_INSTRUCTOR + 1) })?.code).toBe("TOO_LONG");
    expect(err({ topic: "c".repeat(MAX_TOPIC + 1) })?.code).toBe("TOO_LONG");
    expect(err({ locationSlug: "d".repeat(MAX_LOCATION_SLUG + 1) })?.code).toBe("TOO_LONG");
  });

  it("rejects hostile or malformed strings", () => {
    expect(err({ locationSlug: "../../etc/passwd" })?.code).toBe("INVALID");
    expect(err({ locationSlug: "<script>alert(1)</script>" })?.code).toBe("INVALID");
    expect(err({ locationSlug: "main room" })?.code).toBe("INVALID"); // spaces not allowed
    expect(err({ instructorId: { $ne: null } })?.code).toBe("INVALID");
    expect(err({ instructorId: "x".repeat(65) })?.code).toBe("INVALID");
    expect(err({ topic: 12345 })?.code).toBe("INVALID");
  });

  it("keeps a hostile-but-typed classType as plain trimmed text (escaping is the view's job)", () => {
    const res = validateScheduleInput({ ...valid, classType: "<b>gi</b>" });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.classType).toBe("<b>gi</b>");
  });
});
