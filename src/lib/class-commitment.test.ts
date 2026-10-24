import { describe, it, expect } from "vitest";
import {
  commitmentDateKey,
  normalizeClassDate,
  occurrenceIdentity,
  parseCommitmentKey,
  resolveCommitment,
  CommitmentError,
} from "./class-commitment";
import { upcomingOccurrences, type ScheduleSlot } from "./class-window";

const slot = (id: string, dayOfWeek: number, startTime: string, classType = "BJJ", locationSlug = "main"): ScheduleSlot => ({
  id,
  dayOfWeek,
  startTime,
  endTime: "23:00",
  classType,
  instructor: "Coach",
  locationSlug,
});

describe("class-commitment contract", () => {
  it("parses composite and legacy keys", () => {
    expect(parseCommitmentKey("BJJ@18:00")).toEqual({ classType: "BJJ", startTime: "18:00" });
    expect(parseCommitmentKey("Kids BJJ")).toEqual({ classType: "Kids BJJ", startTime: null });
    expect(parseCommitmentKey("a@b@19:30")).toEqual({ classType: "a@b", startTime: "19:30" });
  });

  it("reads canonical and legacy browser-local dates as the academy-local date", () => {
    expect(commitmentDateKey(new Date("2026-10-26T00:00:00Z"), "America/Chicago")).toBe("2026-10-26");
    expect(commitmentDateKey(new Date("2026-10-26T05:00:00Z"), "America/Chicago")).toBe("2026-10-26");
    // Eastern-hemisphere local midnight is the previous UTC day.
    expect(commitmentDateKey(new Date("2026-10-25T18:30:00Z"), "Asia/Kolkata")).toBe("2026-10-26");
  });

  it("normalizes client dates and rejects garbage", () => {
    expect(normalizeClassDate("2026-10-26", "America/Chicago")?.toISOString()).toBe("2026-10-26T00:00:00.000Z");
    expect(normalizeClassDate("2026-10-26T05:00:00.000Z", "America/Chicago")?.toISOString()).toBe("2026-10-26T00:00:00.000Z");
    expect(normalizeClassDate("2026-02-30", "America/Chicago")).toBeNull();
    expect(normalizeClassDate("nope", "America/Chicago")).toBeNull();
    expect(normalizeClassDate(42, "America/Chicago")).toBeNull();
  });

  it("resolves same-type classes by start time and refuses to guess legacy ambiguity", () => {
    const slots = [slot("six", 1, "18:00"), slot("seven", 1, "19:30"), slot("kids", 1, "17:00", "Kids")];
    const d = new Date("2026-10-26T00:00:00Z"); // Monday
    expect(resolveCommitment({ classDate: d, classType: "BJJ@19:30", locationSlug: "main" }, slots, "America/Chicago")).toEqual({ status: "resolved", scheduleId: "seven" });
    expect(resolveCommitment({ classDate: d, classType: "BJJ", locationSlug: "main" }, slots, "America/Chicago").status).toBe("ambiguous");
    expect(resolveCommitment({ classDate: d, classType: "Kids", locationSlug: "main" }, slots, "America/Chicago")).toEqual({ status: "resolved", scheduleId: "kids" });
    expect(resolveCommitment({ classDate: d, classType: "BJJ@06:00", locationSlug: "main" }, slots, "America/Chicago").status).toBe("unmatched");
  });

  it("keeps different locations apart", () => {
    const slots = [slot("north", 1, "18:00", "BJJ", "north"), slot("south", 1, "18:00", "BJJ", "south")];
    const d = new Date("2026-10-26T00:00:00Z");
    expect(resolveCommitment({ classDate: d, classType: "BJJ@18:00", locationSlug: "south" }, slots, "America/Chicago")).toEqual({ status: "resolved", scheduleId: "south" });
  });

  it("upcoming occurrences skip started classes and cross the DST change on the academy clock", () => {
    const slots = [slot("sun9", 0, "09:00"), slot("mon7", 1, "07:00")];
    // Sat 2026-10-31 20:00 CDT → next Sun 09:00 CST (after fall-back) then Mon.
    const occ = upcomingOccurrences(slots, new Date("2026-11-01T01:00:00Z"), "America/Chicago", 3);
    expect(occ.map((o) => `${o.scheduleId}:${o.dateKey}`)).toEqual(["sun9:2026-11-01", "mon7:2026-11-02"]);
    // Sun 09:30 local → today's 09:00 has started and is excluded.
    const later = upcomingOccurrences(slots, new Date("2026-11-01T15:30:00Z"), "America/Chicago", 2);
    expect(later.map((o) => o.scheduleId)).toEqual(["mon7"]);
  });

  it("occurrenceIdentity only accepts real upcoming occurrences", () => {
    const s = slot("mon", 1, "18:00");
    const now = new Date("2026-10-26T20:00:00Z"); // Mon 15:00 CDT
    expect(occurrenceIdentity(s, "2026-10-26", now, "America/Chicago")).toEqual({
      classDate: new Date("2026-10-26T00:00:00Z"),
      classType: "BJJ@18:00",
      locationSlug: "main",
    });
    expect(() => occurrenceIdentity(s, "2026-10-27", now, "America/Chicago")).toThrow(CommitmentError); // Tuesday
    expect(() => occurrenceIdentity(s, "2026-10-19", now, "America/Chicago")).toThrow(CommitmentError); // past
    expect(() => occurrenceIdentity(null, "2026-10-26", now, "America/Chicago")).toThrow(CommitmentError);
  });
});
