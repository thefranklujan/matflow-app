import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  requireOwnerAccess: vi.fn(),
  entitlementErrorBody: vi.fn(() => null),
  instructorFindFirst: vi.fn(),
  scheduleCreate: vi.fn(),
  scheduleFindMany: vi.fn(),
}));

vi.mock("@/lib/owner-access", () => ({
  requireOwnerAccess: mocks.requireOwnerAccess,
  entitlementErrorBody: mocks.entitlementErrorBody,
}));
vi.mock("@/lib/auth", () => ({ requireAdmin: vi.fn(async () => ({ gymId: "gym_1" })) }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    instructor: { findFirst: mocks.instructorFindFirst },
    classSchedule: { create: mocks.scheduleCreate, findMany: mocks.scheduleFindMany },
  },
}));

import { POST } from "./route";

function post(body: unknown) {
  return new Request("http://localhost/api/admin/schedule", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;
}

const valid = {
  dayOfWeek: 1,
  startTime: "18:00",
  endTime: "19:30",
  classType: "gi",
  instructor: "Prof. Silva",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireOwnerAccess.mockResolvedValue({ gymId: "gym_1" });
  mocks.entitlementErrorBody.mockReturnValue(null);
  mocks.scheduleCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: "sched_new", ...data }));
});

describe("POST /api/admin/schedule — validation contract", () => {
  it("creates a class for a valid submission", async () => {
    const res = await POST(post(valid));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.classType).toBe("gi");
    expect(body.locationSlug).toBe("main");
    expect(mocks.scheduleCreate).toHaveBeenCalledTimes(1);
  });

  it("accepts a midnight-crossing class", async () => {
    const res = await POST(post({ ...valid, startTime: "23:00", endTime: "00:30" }));
    expect(res.status).toBe(201);
  });

  const rejections: { name: string; body: Record<string, unknown>; code: string }[] = [
    { name: "missing class type", body: { classType: "" }, code: "REQUIRED" },
    { name: "whitespace instructor", body: { instructor: "   " }, code: "REQUIRED" },
    { name: "day below range", body: { dayOfWeek: -1 }, code: "INVALID_DAY" },
    { name: "day above range", body: { dayOfWeek: 7 }, code: "INVALID_DAY" },
    { name: "non-integer day", body: { dayOfWeek: 2.5 }, code: "INVALID_DAY" },
    { name: "malformed start", body: { startTime: "6pm" }, code: "INVALID_START_TIME" },
    { name: "malformed end", body: { endTime: "19:75" }, code: "INVALID_END_TIME" },
    { name: "equal times", body: { endTime: "18:00" }, code: "EQUAL_TIMES" },
    { name: "over-length class type", body: { classType: "a".repeat(61) }, code: "TOO_LONG" },
    { name: "hostile location", body: { locationSlug: "../../etc/passwd" }, code: "INVALID" },
  ];

  for (const { name, body, code } of rejections) {
    it(`rejects ${name} with 400 ${code} and never writes`, async () => {
      const res = await POST(post({ ...valid, ...body }));
      expect(res.status).toBe(400);
      const payload = await res.json();
      expect(payload.code).toBe(code);
      expect(typeof payload.error).toBe("string");
      expect(payload.error.length).toBeGreaterThan(0);
      expect(mocks.scheduleCreate).not.toHaveBeenCalled();
    });
  }

  it("rejects a malformed JSON body with 400, not 500", async () => {
    const res = await POST(post("{not json"));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_BODY");
    expect(mocks.scheduleCreate).not.toHaveBeenCalled();
  });

  it("rejects an instructor from another academy and writes nothing", async () => {
    mocks.instructorFindFirst.mockResolvedValue(null); // not found within gym_1
    const res = await POST(post({ ...valid, instructorId: "instr_other_gym" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("INVALID_INSTRUCTOR");
    expect(mocks.scheduleCreate).not.toHaveBeenCalled();
    // The lookup must be scoped to the authenticated academy.
    expect(mocks.instructorFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "instr_other_gym", gymId: "gym_1" } }),
    );
  });

  it("accepts an instructor that belongs to the academy", async () => {
    mocks.instructorFindFirst.mockResolvedValue({ id: "instr_mine" });
    const res = await POST(post({ ...valid, instructorId: "instr_mine" }));
    expect(res.status).toBe(201);
    expect(mocks.scheduleCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ instructorId: "instr_mine", gymId: "gym_1" }) }),
    );
  });

  it("never trusts a client-supplied gymId", async () => {
    await POST(post({ ...valid, gymId: "gym_someone_else" }));
    expect(mocks.scheduleCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ gymId: "gym_1" }) }),
    );
  });

  it("returns 401 when not an owner", async () => {
    mocks.requireOwnerAccess.mockRejectedValue(new Error("nope"));
    const res = await POST(post(valid));
    expect(res.status).toBe(401);
    expect(mocks.scheduleCreate).not.toHaveBeenCalled();
  });

  it("returns 402 for a locked-out academy", async () => {
    mocks.requireOwnerAccess.mockRejectedValue(new Error("locked"));
    mocks.entitlementErrorBody.mockReturnValue({ error: "Payment required", state: "past_due" });
    const res = await POST(post(valid));
    expect(res.status).toBe(402);
    expect(mocks.scheduleCreate).not.toHaveBeenCalled();
  });
});
