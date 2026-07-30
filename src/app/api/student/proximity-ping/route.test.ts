import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  requireStudentMembership: vi.fn(),
  scheduleFindMany: vi.fn(),
  notificationCreate: vi.fn(),
  attendanceCreate: vi.fn(),
  attendanceFindMany: vi.fn(),
  notify: vi.fn(),
}));

vi.mock("@/lib/student-membership", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/student-membership")>();
  return { ...actual, requireStudentMembership: mocks.requireStudentMembership };
});
vi.mock("@/lib/prisma", () => ({
  prisma: {
    classSchedule: { findMany: mocks.scheduleFindMany },
    // Wired so ANY unexpected write is visible to the assertions below.
    notification: { create: mocks.notificationCreate },
    attendance: { create: mocks.attendanceCreate, findMany: mocks.attendanceFindMany },
  },
}));
vi.mock("@/lib/push", () => ({ notify: mocks.notify }));

import { GET, POST } from "./route";
import { StaleMembershipError } from "@/lib/student-membership";
import { verifyArrivalToken } from "@/lib/arrival-token";

// A gym AT (0, 0): also proves zero-valued coordinates are treated as valid.
const ZERO_GYM = {
  studentId: "stu_1",
  member: { id: "mem_1", gymId: "gym_1", firstName: "A", lastName: "B" },
  gym: { id: "gym_1", name: "Null Island BJJ", timezone: "America/Chicago", lat: 0, lng: 0, geofenceRadiusM: 200 },
};

function post(body: unknown) {
  return new Request("http://localhost/api/student/proximity-ping", {
    method: "POST",
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireStudentMembership.mockResolvedValue(ZERO_GYM);
  mocks.scheduleFindMany.mockResolvedValue([]);
  mocks.attendanceFindMany.mockResolvedValue([]);
});

describe("proximity GET — pre-location context", () => {
  it("eligible with gym name, radius, and an opaque membership context — never coordinates", async () => {
    const res = await GET();
    const body = await res.json();
    expect(body).toEqual({
      eligible: true,
      gymName: "Null Island BJJ",
      radiusM: 200,
      membershipContext: expect.stringMatching(/^[0-9a-f]{16}$/),
    });
    expect(JSON.stringify(body)).not.toMatch(/lat|lng/);
  });

  it("membershipContext is stable per membership, opaque, and differs across members", async () => {
    const first = (await (await GET()).json()).membershipContext;
    const second = (await (await GET()).json()).membershipContext;
    expect(second).toBe(first); // stable partition key
    // Opaque: no raw id leaks through it.
    expect(first).not.toContain("stu_1");
    expect(first).not.toContain("mem_1");
    expect(first).not.toContain("gym_1");
    // A different membership on the same device gets a different partition.
    mocks.requireStudentMembership.mockResolvedValue({
      ...ZERO_GYM,
      studentId: "stu_2",
      member: { ...ZERO_GYM.member, id: "mem_2" },
    });
    const other = (await (await GET()).json()).membershipContext;
    expect(other).not.toBe(first);
  });

  it("ineligible without gym coordinates (null, not zero)", async () => {
    mocks.requireStudentMembership.mockResolvedValue({
      ...ZERO_GYM,
      gym: { ...ZERO_GYM.gym, lat: null, lng: null },
    });
    expect((await (await GET()).json())).toEqual({ eligible: false, reason: "no_gym_coordinates" });
  });

  it("401 for non-students; ineligible for stale membership", async () => {
    mocks.requireStudentMembership.mockRejectedValue(new StaleMembershipError("not_student"));
    expect((await GET()).status).toBe(401);
    mocks.requireStudentMembership.mockRejectedValue(new StaleMembershipError("no_active_membership"));
    expect(await (await GET()).json()).toEqual({ eligible: false, reason: "no_active_membership" });
  });
});

describe("proximity POST — validation", () => {
  it("401 unauthorized / non-student", async () => {
    mocks.requireStudentMembership.mockRejectedValue(new StaleMembershipError("not_student"));
    expect((await POST(post({ lat: 0, lng: 0 }))).status).toBe(401);
  });

  it("no_active_membership for a stale signed-in membership", async () => {
    mocks.requireStudentMembership.mockRejectedValue(new StaleMembershipError("no_active_membership"));
    expect((await (await POST(post({ lat: 0, lng: 0 }))).json()).result).toBe("no_active_membership");
  });

  it("rejects invalid latitude, longitude, and accuracy", async () => {
    for (const body of [
      { lat: "0", lng: 0 },
      { lat: NaN, lng: 0 },
      { lat: 91, lng: 0 },
      { lat: -91, lng: 0 },
      { lat: 0, lng: 181 },
      { lat: 0, lng: -181 },
      { lat: 0, lng: Infinity },
      { lat: 0, lng: 0, accuracy: -1 },
      { lat: 0, lng: 0, accuracy: "50" },
    ]) {
      expect((await POST(post(body))).status, JSON.stringify(body)).toBe(400);
    }
  });

  it("accuracy_too_low above the 500 m threshold", async () => {
    expect((await (await POST(post({ lat: 0, lng: 0, accuracy: 501 }))).json()).result).toBe("accuracy_too_low");
  });

  it("no_gym_coordinates uses NULL checks — a (0,0) gym is valid", async () => {
    // ZERO_GYM sits at (0,0) and the reading is at (0,0): inside, not missing.
    const res = await (await POST(post({ lat: 0, lng: 0, accuracy: 10 }))).json();
    expect(res.result).toBe("inside_no_class"); // no schedules mocked
    mocks.requireStudentMembership.mockResolvedValue({
      ...ZERO_GYM,
      gym: { ...ZERO_GYM.gym, lat: null, lng: null },
    });
    expect((await (await POST(post({ lat: 0, lng: 0 }))).json()).result).toBe("no_gym_coordinates");
  });
});

describe("proximity POST — decision states and read-only guarantees", () => {
  it("outside: rounded distance, no gym coordinates in the response", async () => {
    // ~1.1 km north of (0,0)
    const res = await (await POST(post({ lat: 0.01, lng: 0, accuracy: 10 }))).json();
    expect(res.result).toBe("outside");
    expect(res.distanceM).toBeGreaterThan(1000);
    expect(Number.isInteger(res.distanceM)).toBe(true);
    expect(JSON.stringify(res)).not.toMatch(/"lat"|"lng"/);
  });

  it("inside_with_classes: candidates + a verifiable arrival attestation", async () => {
    const now = new Date();
    // Build a slot eligible RIGHT NOW in the gym's timezone.
    const { gymLocalNow } = await import("@/lib/class-window");
    const local = gymLocalNow(now, ZERO_GYM.gym.timezone);
    mocks.scheduleFindMany.mockResolvedValue([{
      id: "sched_1",
      dayOfWeek: local.dayOfWeek,
      startTime: `${String(Math.floor(local.minutes / 60)).padStart(2, "0")}:${String(local.minutes % 60).padStart(2, "0")}`,
      endTime: "23:59",
      classType: "gi",
      instructor: "Coach",
      instructorId: null,
      locationSlug: "main",
    }]);
    const res = await (await POST(post({ lat: 0, lng: 0, accuracy: 10 }))).json();
    expect(res.result).toBe("inside_with_classes");
    expect(res.classes).toHaveLength(1);
    expect(res.classes[0].scheduleId).toBe("sched_1");
    // The attestation is real and bound to this student/member/gym.
    await expect(
      verifyArrivalToken(res.arrivalToken, { studentId: "stu_1", memberId: "mem_1", gymId: "gym_1" }),
    ).resolves.toBeUndefined();
  });

  it("excludes an occurrence the member already has an Attendance row for", async () => {
    const now = new Date();
    const { gymLocalNow } = await import("@/lib/class-window");
    const local = gymLocalNow(now, ZERO_GYM.gym.timezone);
    const startTime = `${String(Math.floor(local.minutes / 60)).padStart(2, "0")}:${String(local.minutes % 60).padStart(2, "0")}`;
    mocks.scheduleFindMany.mockResolvedValue([
      { id: "sched_1", dayOfWeek: local.dayOfWeek, startTime, endTime: "23:59", classType: "gi", instructor: "Coach", instructorId: null, locationSlug: "main" },
      { id: "sched_2", dayOfWeek: local.dayOfWeek, startTime, endTime: "23:59", classType: "nogi", instructor: "Coach", instructorId: null, locationSlug: "main" },
    ]);
    // The DB already holds a row for the "gi" occurrence (exact tuple).
    mocks.attendanceFindMany.mockImplementation(async (args: { where: { OR: { classDate: Date; classType: string }[] } }) =>
      args.where.OR.filter((o) => o.classType === "gi").map((o) => ({ classDate: o.classDate, classType: o.classType })),
    );
    const res = await (await POST(post({ lat: 0, lng: 0, accuracy: 10 }))).json();
    expect(res.result).toBe("inside_with_classes");
    expect(res.classes.map((c: { classType: string }) => c.classType)).toEqual(["nogi"]);
  });

  it("inside_no_class when EVERY eligible occurrence is already recorded (cleared device can't re-prompt)", async () => {
    const now = new Date();
    const { gymLocalNow } = await import("@/lib/class-window");
    const local = gymLocalNow(now, ZERO_GYM.gym.timezone);
    const startTime = `${String(Math.floor(local.minutes / 60)).padStart(2, "0")}:${String(local.minutes % 60).padStart(2, "0")}`;
    mocks.scheduleFindMany.mockResolvedValue([
      { id: "sched_1", dayOfWeek: local.dayOfWeek, startTime, endTime: "23:59", classType: "gi", instructor: "Coach", instructorId: null, locationSlug: "main" },
    ]);
    mocks.attendanceFindMany.mockImplementation(async (args: { where: { OR: { classDate: Date; classType: string }[] } }) =>
      args.where.OR.map((o) => ({ classDate: o.classDate, classType: o.classType })),
    );
    const res = await (await POST(post({ lat: 0, lng: 0, accuracy: 10 }))).json();
    expect(res.result).toBe("inside_no_class");
    expect(res.arrivalToken).toBeUndefined();
  });

  it("NEVER notifies the owner, writes Notification rows, creates attendance, or persists coordinates", async () => {
    await POST(post({ lat: 0, lng: 0, accuracy: 10 })); // inside
    await POST(post({ lat: 0.01, lng: 0 })); // outside
    expect(mocks.notify).not.toHaveBeenCalled();
    expect(mocks.notificationCreate).not.toHaveBeenCalled();
    expect(mocks.attendanceCreate).not.toHaveBeenCalled();
  });
});
