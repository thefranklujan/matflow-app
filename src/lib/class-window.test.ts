import { describe, it, expect } from "vitest";
import { gymLocalNow, occurrenceForSlot, eligibleClassesNow, type ScheduleSlot } from "./class-window";

/**
 * All instants below are explicit UTC ISO strings; expectations are in the
 * ACADEMY's zone, so these tests pass identically regardless of the zone the
 * test runner happens to use.
 */

function slot(over: Partial<ScheduleSlot> = {}): ScheduleSlot {
  return {
    id: "sched_1",
    dayOfWeek: 1, // Monday
    startTime: "18:00",
    endTime: "19:00",
    classType: "gi",
    instructor: "Coach",
    locationSlug: "main",
    ...over,
  };
}

// Monday 2026-07-20, America/Chicago = CDT (UTC-5).
const CHI = "America/Chicago";
function chicagoJul20(hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(Date.UTC(2026, 6, 20, h + 5, m)); // CDT = UTC-5
}

describe("gymLocalNow", () => {
  it("reports the academy's wall clock, not the runner's", () => {
    const local = gymLocalNow(new Date("2026-07-20T23:30:00Z"), CHI);
    expect(local).toMatchObject({ year: 2026, month: 7, day: 20, dayOfWeek: 1 }); // Monday
    expect(local.minutes).toBe(18 * 60 + 30); // 6:30 PM CDT
  });

  it("handles a different zone for the same instant (Tokyo is already Tuesday)", () => {
    const local = gymLocalNow(new Date("2026-07-20T23:30:00Z"), "Asia/Tokyo");
    expect(local).toMatchObject({ day: 21, dayOfWeek: 2 }); // Tue 8:30 AM JST
    expect(local.minutes).toBe(8 * 60 + 30);
  });
});

describe("occurrenceForSlot — window boundaries (60 before / 60 after, academy-local)", () => {
  it("opens exactly 60 minutes before start and not a minute earlier", () => {
    expect(occurrenceForSlot(slot(), chicagoJul20("17:00"), CHI)).not.toBeNull(); // 60 min before
    expect(occurrenceForSlot(slot(), chicagoJul20("16:59"), CHI)).toBeNull(); // 61 min before
  });

  it("closes exactly 60 minutes after end and not a minute later", () => {
    expect(occurrenceForSlot(slot(), chicagoJul20("20:00"), CHI)).not.toBeNull(); // end 19:00 + 60
    expect(occurrenceForSlot(slot(), chicagoJul20("20:01"), CHI)).toBeNull();
  });

  it("returns the academy-local class date at UTC midnight and signed minutesFromStart", () => {
    const occ = occurrenceForSlot(slot(), chicagoJul20("17:30"), CHI)!;
    expect(occ.classDate.toISOString()).toBe("2026-07-20T00:00:00.000Z");
    expect(occ.minutesFromStart).toBe(-30); // class starts in 30 min
  });

  it("academy timezone rules, not the server's: same instant differs by zone", () => {
    // Tue 18:30 in Tokyo = Tue 09:30 UTC. A Tuesday-evening Tokyo class is
    // eligible at that instant; the same wall-schedule in Chicago is not
    // (Chicago is Tue 04:30 AM local).
    const instant = new Date("2026-07-21T09:30:00Z");
    const tueSlot = slot({ dayOfWeek: 2 });
    expect(occurrenceForSlot(tueSlot, instant, "Asia/Tokyo")).not.toBeNull();
    expect(occurrenceForSlot(tueSlot, instant, CHI)).toBeNull();
  });

  it("daylight-saving boundary morning still resolves by wall clock (spring forward)", () => {
    // US DST began 2026-03-08 (Sunday) at 2 AM Chicago (8:00Z). 12:30Z = 7:30 AM CDT.
    const sundayMorning = slot({ dayOfWeek: 0, startTime: "07:00", endTime: "08:00" });
    const occ = occurrenceForSlot(sundayMorning, new Date("2026-03-08T12:30:00Z"), CHI);
    expect(occ).not.toBeNull(); // 7:30 AM is inside the window for a 7:00 class
    expect(occ!.classDate.toISOString()).toBe("2026-03-08T00:00:00.000Z");
    // 10:30Z = 5:30 AM CDT: before the 6:00 AM window opening, so not eligible.
    expect(occurrenceForSlot(sundayMorning, new Date("2026-03-08T10:30:00Z"), CHI)).toBeNull();
  });

  it("midnight-crossing class: eligible after midnight, attributed to the START day", () => {
    // Friday 23:00 - 00:30. Saturday 01:15 local is inside end(00:30)+60m.
    const late = slot({ dayOfWeek: 5, startTime: "23:00", endTime: "00:30" });
    // Sat 2026-07-25 01:15 CDT = 06:15Z
    const occ = occurrenceForSlot(late, new Date("2026-07-25T06:15:00Z"), CHI);
    expect(occ).not.toBeNull();
    expect(occ!.classDate.toISOString()).toBe("2026-07-24T00:00:00.000Z"); // Friday
    // Sat 01:31 local is past the window.
    expect(occurrenceForSlot(late, new Date("2026-07-25T06:31:00Z"), CHI)).toBeNull();
  });

  it("very early class: window opens the previous local evening", () => {
    // Tuesday 00:15 - 01:00; Monday 23:20 local is inside start-60m (23:15).
    const early = slot({ dayOfWeek: 2, startTime: "00:15", endTime: "01:00" });
    const occ = occurrenceForSlot(early, chicagoJul20("23:20"), CHI); // Mon 11:20 PM
    expect(occ).not.toBeNull();
    expect(occ!.classDate.toISOString()).toBe("2026-07-21T00:00:00.000Z"); // Tuesday
  });

  it("rejects malformed times instead of guessing", () => {
    expect(occurrenceForSlot(slot({ startTime: "25:00" }), chicagoJul20("18:30"), CHI)).toBeNull();
    expect(occurrenceForSlot(slot({ endTime: "junk" }), chicagoJul20("18:30"), CHI)).toBeNull();
  });
});

describe("eligibleClassesNow", () => {
  it("returns only in-window classes, nearest start first", () => {
    const slots = [
      slot({ id: "a", startTime: "18:00", endTime: "19:00" }), // 30 min away at 17:30
      slot({ id: "b", startTime: "17:00", endTime: "18:00" }), // started 30 min ago...
      slot({ id: "c", startTime: "12:00", endTime: "13:00" }), // long over
      slot({ id: "d", dayOfWeek: 3 }), // wrong day
    ];
    const result = eligibleClassesNow(slots, chicagoJul20("17:30"), CHI);
    expect(result.map((r) => r.scheduleId)).toEqual(["a", "b"]); // |−30| ties broken by order; both 30
    expect(result.every((r) => Math.abs(r.minutesFromStart) === 30)).toBe(true);
  });
});
