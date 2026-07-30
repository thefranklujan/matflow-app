import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  requireStudentMembership: vi.fn(),
  scheduleFindFirst: vi.fn(),
  attendanceCreate: vi.fn(),
  attendanceFindFirst: vi.fn(),
  logActivity: vi.fn(),
  maybeNotifyStreakMilestone: vi.fn(),
  notify: vi.fn(),
}));

vi.mock("@/lib/student-membership", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/student-membership")>();
  return { ...actual, requireStudentMembership: mocks.requireStudentMembership };
});
vi.mock("@/lib/prisma", () => ({
  prisma: {
    classSchedule: { findFirst: mocks.scheduleFindFirst },
    attendance: { create: mocks.attendanceCreate, findFirst: mocks.attendanceFindFirst },
  },
}));
vi.mock("@/lib/activity-log", () => ({ logActivity: mocks.logActivity }));
vi.mock("@/lib/attendance-streak", () => ({ maybeNotifyStreakMilestone: mocks.maybeNotifyStreakMilestone }));
vi.mock("@/lib/push", () => ({ notify: mocks.notify }));

import { POST } from "./route";
import { StaleMembershipError } from "@/lib/student-membership";
import { signArrivalToken } from "@/lib/arrival-token";
import { gymLocalNow } from "@/lib/class-window";

const MEMBERSHIP = {
  studentId: "stu_1",
  member: { id: "mem_1", gymId: "gym_1", firstName: "Ana", lastName: "One" },
  gym: { id: "gym_1", name: "Test BJJ", timezone: "America/Chicago", lat: 0, lng: 0, geofenceRadiusM: 200 },
};

function post(body: unknown) {
  return new Request("http://localhost/api/student/attendance/check-in", {
    method: "POST",
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;
}

/** A schedule row whose check-in window contains "now" in the gym's zone. */
function eligibleScheduleNow(over: Record<string, unknown> = {}) {
  const local = gymLocalNow(new Date(), MEMBERSHIP.gym.timezone);
  return {
    id: "sched_1",
    dayOfWeek: local.dayOfWeek,
    startTime: `${String(Math.floor(local.minutes / 60)).padStart(2, "0")}:${String(local.minutes % 60).padStart(2, "0")}`,
    endTime: "23:59",
    classType: "gi",
    instructor: "Coach",
    locationSlug: "main",
    ...over,
  };
}

function p2002() {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
  });
}

async function validToken() {
  return signArrivalToken({ studentId: "stu_1", memberId: "mem_1", gymId: "gym_1" });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireStudentMembership.mockResolvedValue(MEMBERSHIP);
  mocks.scheduleFindFirst.mockResolvedValue(eligibleScheduleNow());
  mocks.attendanceCreate.mockResolvedValue({ id: "att_1" });
  mocks.maybeNotifyStreakMilestone.mockResolvedValue(undefined);
});

describe("self-check-in — auth and token", () => {
  it("401 for non-students; 409 for stale membership", async () => {
    mocks.requireStudentMembership.mockRejectedValue(new StaleMembershipError("not_student"));
    expect((await POST(post({ arrivalToken: "x", classScheduleId: "s" }))).status).toBe(401);
    mocks.requireStudentMembership.mockRejectedValue(new StaleMembershipError("no_active_membership"));
    expect((await POST(post({ arrivalToken: "x", classScheduleId: "s" }))).status).toBe(409);
  });

  it("400 without token or class id", async () => {
    expect((await POST(post({}))).status).toBe(400);
    expect((await POST(post({ arrivalToken: "x" }))).status).toBe(400);
  });

  it("token_invalid for garbage; binding mismatch also fails closed", async () => {
    const res = await POST(post({ arrivalToken: "garbage", classScheduleId: "sched_1" }));
    expect(res.status).toBe(401);
    expect((await res.json()).result).toBe("token_invalid");

    // Token minted for a DIFFERENT member cannot check this member in.
    const foreign = await signArrivalToken({ studentId: "stu_1", memberId: "mem_OTHER", gymId: "gym_1" });
    const res2 = await POST(post({ arrivalToken: foreign, classScheduleId: "sched_1" }));
    expect((await res2.json()).result).toBe("token_invalid");
    expect(mocks.attendanceCreate).not.toHaveBeenCalled();
  });
});

describe("self-check-in — schedule and window revalidation", () => {
  it("class_not_found for inactive or cross-gym schedules (gym-scoped active query)", async () => {
    mocks.scheduleFindFirst.mockResolvedValue(null);
    const res = await POST(post({ arrivalToken: await validToken(), classScheduleId: "sched_other_gym" }));
    expect(res.status).toBe(404);
    expect(mocks.scheduleFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ gymId: "gym_1", active: true }) }),
    );
  });

  it("outside_window when the occurrence is no longer eligible", async () => {
    // A class on a different weekday can never be in today's window.
    const local = gymLocalNow(new Date(), MEMBERSHIP.gym.timezone);
    mocks.scheduleFindFirst.mockResolvedValue(eligibleScheduleNow({ dayOfWeek: (local.dayOfWeek + 3) % 7 }));
    const res = await POST(post({ arrivalToken: await validToken(), classScheduleId: "sched_1" }));
    expect(res.status).toBe(409);
    expect((await res.json()).result).toBe("outside_window");
    expect(mocks.attendanceCreate).not.toHaveBeenCalled();
  });
});

describe("self-check-in — attendance creation", () => {
  it("creates attendance with ALL fields derived server-side (client fields ignored)", async () => {
    const res = await POST(post({
      arrivalToken: await validToken(),
      classScheduleId: "sched_1",
      // Hostile extras that must be ignored:
      gymId: "gym_ATTACKER",
      memberId: "mem_ATTACKER",
      classType: "fake",
      classDate: "1999-01-01",
      locationSlug: "fake",
    }));
    expect(res.status).toBe(201);
    expect((await res.json()).result).toBe("checked_in");
    const data = mocks.attendanceCreate.mock.calls[0][0].data;
    expect(data.gymId).toBe("gym_1");
    expect(data.memberId).toBe("mem_1");
    expect(data.classType).toBe("gi");
    expect(data.locationSlug).toBe("main");
    expect(data.classDate.toISOString()).toMatch(/T00:00:00\.000Z$/); // day-granular convention
  });

  it("activity log distinguishes self-check-in and carries no coordinates; streaks fire; owner is NOT pushed", async () => {
    await POST(post({ arrivalToken: await validToken(), classScheduleId: "sched_1" }));
    expect(mocks.logActivity).toHaveBeenCalledTimes(1);
    const logged = mocks.logActivity.mock.calls[0][0];
    expect(logged.action).toBe("self_check_in");
    expect(JSON.stringify(logged)).not.toMatch(/lat|lng|accuracy/i);
    expect(mocks.maybeNotifyStreakMilestone).toHaveBeenCalledWith({ memberId: "mem_1", gymId: "gym_1" });
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it("duplicate request returns already_checked_in (idempotent), not an error", async () => {
    mocks.attendanceCreate.mockRejectedValue(p2002());
    mocks.attendanceFindFirst.mockResolvedValue({ locationSlug: "main" });
    const res = await POST(post({ arrivalToken: await validToken(), classScheduleId: "sched_1" }));
    expect(res.status).toBe(200);
    expect((await res.json()).result).toBe("already_checked_in");
    expect(mocks.logActivity).not.toHaveBeenCalled(); // no duplicate log
  });

  it("concurrent duplicates: one row created, the loser gets already_checked_in", async () => {
    let calls = 0;
    mocks.attendanceCreate.mockImplementation(async () => {
      calls += 1;
      if (calls > 1) throw p2002();
      return { id: "att_1" };
    });
    mocks.attendanceFindFirst.mockResolvedValue({ locationSlug: "main" });
    const token = await validToken();
    const [r1, r2] = await Promise.all([
      POST(post({ arrivalToken: token, classScheduleId: "sched_1" })),
      POST(post({ arrivalToken: token, classScheduleId: "sched_1" })),
    ]);
    const results = [(await r1.json()).result, (await r2.json()).result].sort();
    expect(results).toEqual(["already_checked_in", "checked_in"]);
    expect(mocks.logActivity).toHaveBeenCalledTimes(1); // only the winner logs
  });

  it("a collision at a DIFFERENT location is a clear conflict, never silently the selected class", async () => {
    mocks.attendanceCreate.mockRejectedValue(p2002());
    mocks.attendanceFindFirst.mockResolvedValue({ locationSlug: "cypress" });
    const res = await POST(post({ arrivalToken: await validToken(), classScheduleId: "sched_1" }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.result).toBe("location_conflict");
    expect(body.existingLocation).toBe("cypress");
  });
});
