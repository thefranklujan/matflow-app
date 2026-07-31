import { describe, it, expect } from "vitest";
import {
  OWNER_BASELINE_MEMBERS,
  type ActivationFacts,
  type MilestoneKey,
  daysSince,
  evaluateActivation,
  trialDaysRemaining,
} from "./activation";

const NOTHING: ActivationFacts = {
  description: null,
  city: null,
  state: null,
  activeMemberCount: OWNER_BASELINE_MEMBERS, // owner only
  activeInstructorCount: 0,
  activeScheduleCount: 0,
  attendanceCount: 0,
};

/** Facts that satisfy exactly the requested milestones. */
function factsFor(complete: Record<MilestoneKey, boolean>): ActivationFacts {
  return {
    description: complete.profile ? "A gym" : null,
    city: complete.profile ? "Houston" : null,
    state: complete.profile ? "TX" : null,
    activeMemberCount: complete.firstMember ? OWNER_BASELINE_MEMBERS + 1 : OWNER_BASELINE_MEMBERS,
    activeInstructorCount: complete.instructor ? 1 : 0,
    activeScheduleCount: complete.schedule ? 1 : 0,
    attendanceCount: 0,
  };
}

const KEYS: MilestoneKey[] = ["profile", "firstMember", "instructor", "schedule"];

describe("evaluateActivation — all 16 milestone combinations", () => {
  for (let mask = 0; mask < 16; mask++) {
    const complete = {
      profile: Boolean(mask & 1),
      firstMember: Boolean(mask & 2),
      instructor: Boolean(mask & 4),
      schedule: Boolean(mask & 8),
    } as Record<MilestoneKey, boolean>;
    const expectedCount = KEYS.filter((k) => complete[k]).length;

    it(`mask ${mask}: ${expectedCount}/4 complete`, () => {
      const res = evaluateActivation(factsFor(complete));
      expect(res.completedCount).toBe(expectedCount);
      expect(res.totalCount).toBe(4);
      expect(res.percentComplete).toBe(Math.round((expectedCount / 4) * 100));
      expect(res.isActivated).toBe(expectedCount === 4);

      for (const key of KEYS) {
        expect(res.milestones.find((m) => m.key === key)!.complete, key).toBe(complete[key]);
      }

      if (expectedCount === 4) {
        expect(res.activationState).toBe("activated");
        expect(res.nextMilestone).toBeNull();
      } else if (expectedCount === 0) {
        expect(res.activationState).toBe("not_started");
        expect(res.nextMilestone!.key).toBe(KEYS.find((k) => !complete[k]));
      } else {
        expect(res.activationState).toBe("in_progress");
        // The next milestone is always the FIRST incomplete one, in order.
        expect(res.nextMilestone!.key).toBe(KEYS.find((k) => !complete[k]));
      }
    });
  }
});

describe("the owner is never counted as the first member", () => {
  it("owner alone does not complete the member milestone", () => {
    const res = evaluateActivation({ ...NOTHING, activeMemberCount: OWNER_BASELINE_MEMBERS });
    expect(res.milestones.find((m) => m.key === "firstMember")!.complete).toBe(false);
  });

  it("one member beyond the owner completes it", () => {
    const res = evaluateActivation({ ...NOTHING, activeMemberCount: OWNER_BASELINE_MEMBERS + 1 });
    expect(res.milestones.find((m) => m.key === "firstMember")!.complete).toBe(true);
  });

  it("a zero or negative count never completes it", () => {
    for (const count of [0, -1]) {
      const res = evaluateActivation({ ...NOTHING, activeMemberCount: count });
      expect(res.milestones.find((m) => m.key === "firstMember")!.complete, String(count)).toBe(false);
    }
  });
});

describe("profile completeness requires all three fields and rejects whitespace", () => {
  const base = { ...NOTHING };
  it("needs description, city, AND state", () => {
    expect(evaluateActivation({ ...base, description: "d", city: "c", state: null }).milestones[0].complete).toBe(false);
    expect(evaluateActivation({ ...base, description: "d", city: null, state: "s" }).milestones[0].complete).toBe(false);
    expect(evaluateActivation({ ...base, description: null, city: "c", state: "s" }).milestones[0].complete).toBe(false);
    expect(evaluateActivation({ ...base, description: "d", city: "c", state: "s" }).milestones[0].complete).toBe(true);
  });

  it("treats whitespace-only values as empty", () => {
    expect(evaluateActivation({ ...base, description: "   ", city: "c", state: "s" }).milestones[0].complete).toBe(false);
    expect(evaluateActivation({ ...base, description: "d", city: "\t", state: "s" }).milestones[0].complete).toBe(false);
  });
});

describe("activation is separate from live usage", () => {
  const activated = factsFor({ profile: true, firstMember: true, instructor: true, schedule: true });

  it("an activated academy with no attendance is activated but not live", () => {
    const res = evaluateActivation({ ...activated, attendanceCount: 0 });
    expect(res.isActivated).toBe(true);
    expect(res.hasLiveUsage).toBe(false);
    expect(res.liveUsageState).toBe("no_attendance");
  });

  it("attendance makes it live", () => {
    const res = evaluateActivation({ ...activated, attendanceCount: 1 });
    expect(res.hasLiveUsage).toBe(true);
    expect(res.liveUsageState).toBe("live");
  });

  it("attendance alone never implies activation", () => {
    const res = evaluateActivation({ ...NOTHING, attendanceCount: 250 });
    expect(res.hasLiveUsage).toBe(true);
    expect(res.isActivated).toBe(false);
    expect(res.activationState).toBe("not_started");
  });
});

describe("milestones carry actionable destinations", () => {
  it("every milestone has a label, description, and href", () => {
    for (const m of evaluateActivation(NOTHING).milestones) {
      expect(m.label.length).toBeGreaterThan(0);
      expect(m.description.length).toBeGreaterThan(0);
      expect(m.href.startsWith("/app")).toBe(true);
    }
  });
});

describe("trialDaysRemaining — time is injected", () => {
  const now = new Date("2026-07-31T12:00:00.000Z");

  it("counts whole days forward", () => {
    expect(trialDaysRemaining(new Date("2026-08-30T12:00:00.000Z"), now)).toBe(30);
    expect(trialDaysRemaining(new Date("2026-08-03T12:00:00.000Z"), now)).toBe(3);
    expect(trialDaysRemaining(new Date("2026-07-31T12:00:00.000Z"), now)).toBe(0);
  });

  it("goes negative once expired and is null without a trial", () => {
    expect(trialDaysRemaining(new Date("2026-07-28T12:00:00.000Z"), now)).toBe(-3);
    expect(trialDaysRemaining(null, now)).toBeNull();
  });

  it("rounds partial days up so 'ends tomorrow' never reads as 0", () => {
    expect(trialDaysRemaining(new Date("2026-08-01T06:00:00.000Z"), now)).toBe(1);
  });
});

describe("daysSince", () => {
  const now = new Date("2026-07-31T12:00:00.000Z");
  it("is 0 on the signup day and counts whole days after", () => {
    expect(daysSince(new Date("2026-07-31T01:00:00.000Z"), now)).toBe(0);
    expect(daysSince(new Date("2026-07-28T12:00:00.000Z"), now)).toBe(3);
    expect(daysSince(new Date("2026-07-01T12:00:00.000Z"), now)).toBe(30);
  });
});
