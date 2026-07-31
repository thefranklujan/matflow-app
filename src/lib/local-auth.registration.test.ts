import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Atomicity of academy registration, tested at the REAL implementation
 * boundary: registerGymOwner() is exercised against a transaction-shaped
 * Prisma mock, so the gym, owner membership, and gym_created audit row must
 * all be written through the SAME transaction client.
 *
 * The previous route test mocked logActivity as an async function, which
 * turned a void, fire-and-forget helper into an awaitable promise and hid the
 * fact that nothing was ever awaited. Nothing here mocks logActivity at all.
 */

const mocks = vi.hoisted(() => ({
  memberFindFirst: vi.fn(),
  gymFindUnique: vi.fn(),
  transaction: vi.fn(),
  nominationFindMany: vi.fn(),
  activityCreateOutsideTx: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    member: { findFirst: mocks.memberFindFirst },
    gym: { findUnique: mocks.gymFindUnique },
    $transaction: mocks.transaction,
    gymNomination: { findMany: mocks.nominationFindMany },
    joinRequest: { upsert: vi.fn(), findFirst: vi.fn() },
    // If registration ever writes an activity row OUTSIDE the transaction this
    // spy catches it.
    activityLog: { create: mocks.activityCreateOutsideTx },
  },
}));
vi.mock("@/lib/member-capacity", () => ({
  lockMemberCapacity: vi.fn(),
  assertSeatAvailable: vi.fn(),
}));

import { registerGymOwner, DuplicateRegistrationError } from "./local-auth";

/** Records every write and which client performed it. */
function makeTx() {
  const writes: { model: string; data: Record<string, unknown> }[] = [];
  const tx = {
    gym: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        writes.push({ model: "gym", data });
        return { id: "gym_new", name: data.name, slug: data.slug };
      }),
    },
    member: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        writes.push({ model: "member", data });
        return { id: "mem_new" };
      }),
    },
    activityLog: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        writes.push({ model: "activityLog", data });
        return { id: "act_new" };
      }),
    },
  };
  return { tx, writes };
}

const input = {
  email: "owner@e2e.matflow.test",
  password: "correct horse",
  firstName: "Marcus",
  lastName: "Vega",
  gymName: "Iron Lion",
  gymSlug: "iron-lion",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.memberFindFirst.mockResolvedValue(null);
  mocks.gymFindUnique.mockResolvedValue(null);
  mocks.nominationFindMany.mockResolvedValue([]);
});

describe("registerGymOwner — one transaction for gym, owner, and audit", () => {
  it("writes gym, member, AND gym_created through the same transaction client", async () => {
    const { tx, writes } = makeTx();
    mocks.transaction.mockImplementation(async (fn: (c: typeof tx) => Promise<unknown>) => fn(tx));

    const result = await registerGymOwner(input);

    expect(result.gym.id).toBe("gym_new");
    expect(writes.map((w) => w.model)).toEqual(["gym", "member", "activityLog"]);
    // The audit row is the real gym_created record for THIS academy.
    const audit = writes.find((w) => w.model === "activityLog")!.data;
    expect(audit.action).toBe("gym_created");
    expect(audit.gymId).toBe("gym_new");
    expect(audit.targetName).toBe("Iron Lion");
    // Nothing was written outside the transaction.
    expect(mocks.activityCreateOutsideTx).not.toHaveBeenCalled();
    expect(tx.activityLog.create).toHaveBeenCalledTimes(1);
  });

  it("rolls back everything when the audit write fails", async () => {
    const { tx } = makeTx();
    tx.activityLog.create.mockRejectedValue(new Error("activity table gone"));
    // A real $transaction propagates the rejection and commits nothing.
    mocks.transaction.mockImplementation(async (fn: (c: typeof tx) => Promise<unknown>) => fn(tx));

    await expect(registerGymOwner(input)).rejects.toThrow("activity table gone");
    // The caller never receives an academy, so no success can be reported.
    expect(mocks.activityCreateOutsideTx).not.toHaveBeenCalled();
  });

  it("rolls back when the member write fails, leaving no academy", async () => {
    const { tx, writes } = makeTx();
    tx.member.create.mockRejectedValue(new Error("member insert failed"));
    mocks.transaction.mockImplementation(async (fn: (c: typeof tx) => Promise<unknown>) => fn(tx));

    await expect(registerGymOwner(input)).rejects.toThrow("member insert failed");
    // The audit row is never reached.
    expect(writes.some((w) => w.model === "activityLog")).toBe(false);
  });

  it("maps a unique-constraint race to a stable duplicate error", async () => {
    mocks.transaction.mockRejectedValue(Object.assign(new Error("unique"), { code: "P2002", meta: { target: ["slug"] } }));
    await expect(registerGymOwner(input)).rejects.toBeInstanceOf(DuplicateRegistrationError);

    mocks.transaction.mockRejectedValue(Object.assign(new Error("unique"), { code: "P2002", meta: { target: ["gymId", "email"] } }));
    await expect(registerGymOwner(input)).rejects.toMatchObject({ field: "email" });
  });

  it("uses collision-safe compatibility identifiers", async () => {
    const { tx, writes } = makeTx();
    mocks.transaction.mockImplementation(async (fn: (c: typeof tx) => Promise<unknown>) => fn(tx));
    await registerGymOwner(input);
    const gym = writes.find((w) => w.model === "gym")!.data;
    const member = writes.find((w) => w.model === "member")!.data;
    // UUID-shaped, not a timestamp that two concurrent signups can share.
    expect(String(gym.clerkOrgId)).toMatch(/^owner-[0-9a-f-]{36}$/);
    expect(String(member.clerkUserId)).toMatch(/^owner-[0-9a-f-]{36}$/);
    expect(gym.clerkOrgId).not.toBe(member.clerkUserId);
  });

  it("preserves the 30-day trial and self-serve approval", async () => {
    const { tx, writes } = makeTx();
    mocks.transaction.mockImplementation(async (fn: (c: typeof tx) => Promise<unknown>) => fn(tx));
    const before = Date.now();
    await registerGymOwner(input);
    const gym = writes.find((w) => w.model === "gym")!.data;
    expect(gym.subscriptionStatus).toBe("trialing");
    expect(gym.approved).toBe(true);
    const trialEnd = (gym.trialEndsAt as Date).getTime();
    const days = Math.round((trialEnd - before) / (24 * 60 * 60 * 1000));
    expect(days).toBe(30);
  });

  it("nomination claiming failure cannot invalidate a committed academy", async () => {
    const { tx } = makeTx();
    mocks.transaction.mockImplementation(async (fn: (c: typeof tx) => Promise<unknown>) => fn(tx));
    mocks.nominationFindMany.mockRejectedValue(new Error("nominations unavailable"));
    const result = await registerGymOwner(input);
    expect(result.gym.id).toBe("gym_new");
  });
});
