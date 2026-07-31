import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.mock factories are hoisted above module scope, so the error class the
// route does `instanceof` against must be created inside vi.hoisted too.
const mocks = vi.hoisted(() => {
  class DuplicateRegistrationError extends Error {
    constructor(public readonly field: "email" | "gymSlug", message: string) {
      super(message);
      this.name = "DuplicateRegistrationError";
    }
  }
  return {
    registerGymOwner: vi.fn(),
    createSession: vi.fn(),
    sendWelcomeEmail: vi.fn(),
    notifyFrank: vi.fn(),
    DuplicateRegistrationError,
  };
});
const { DuplicateRegistrationError } = mocks;

vi.mock("@/lib/local-auth", () => ({
  registerGymOwner: mocks.registerGymOwner,
  createSession: mocks.createSession,
  DuplicateRegistrationError: mocks.DuplicateRegistrationError,
}));
vi.mock("@/lib/email", () => ({
  sendWelcomeEmail: mocks.sendWelcomeEmail,
  notifyFrankNewGymPending: mocks.notifyFrank,
}));

import { POST } from "./route";

const valid = {
  firstName: "Marcus",
  lastName: "Vega",
  email: "marcus@ironlion.test",
  password: "correct horse",
  gymName: "Iron Lion Academy",
  gymSlug: "iron-lion",
};

function post(body: unknown, headers: Record<string, string> = {}) {
  const req = new Request("http://localhost/api/auth/register", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  // NextRequest adds `.cookies`; a plain Request does not. Parse the header so
  // the route's native-shell cookie check runs exactly as it does in prod.
  const jar = new Map<string, string>();
  for (const part of (headers.cookie || "").split(";")) {
    const [k, v] = part.split("=").map((x) => x?.trim());
    if (k) jar.set(k, v ?? "");
  }
  Object.defineProperty(req, "cookies", {
    value: { get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined) },
  });
  return req as unknown as import("next/server").NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.registerGymOwner.mockResolvedValue({
    gym: { id: "gym_new", name: valid.gymName, slug: valid.gymSlug },
    member: { id: "mem_new" },
  });
  mocks.sendWelcomeEmail.mockResolvedValue(undefined);
  mocks.notifyFrank.mockResolvedValue(undefined);
});

describe("POST /api/auth/register — success contract", () => {
  it("creates exactly one academy, one session, and one gym_created record", async () => {
    const res = await POST(post(valid));
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ success: true, gym: { slug: "iron-lion" } });

    expect(mocks.registerGymOwner).toHaveBeenCalledTimes(1);
    expect(mocks.createSession).toHaveBeenCalledTimes(1);
    // gym_created is written inside registerGymOwner's transaction — see
    // src/lib/local-auth.registration.test.ts. The route must NOT write it
    // separately (the old route-level `await logActivity()` awaited a void
    // return and guaranteed nothing).
    // The session is bound to the newly created academy and owner membership.
    expect(mocks.createSession).toHaveBeenCalledWith(
      expect.objectContaining({ gymId: "gym_new", memberId: "mem_new", role: "admin" }),
    );
  });

  it("normalizes input before it reaches the database", async () => {
    await POST(post({ ...valid, email: "  Marcus@IronLion.TEST ", gymSlug: " Iron--Lion-- ", phone: "(555) 123-4567" }));
    expect(mocks.registerGymOwner).toHaveBeenCalledWith(
      expect.objectContaining({ email: "marcus@ironlion.test", gymSlug: "iron-lion", phone: "5551234567" }),
    );
  });

  it("still succeeds when the welcome email and founder notification fail", async () => {
    mocks.sendWelcomeEmail.mockRejectedValue(new Error("smtp down"));
    mocks.notifyFrank.mockRejectedValue(new Error("smtp down"));
    const res = await POST(post(valid));
    expect(res.status).toBe(201);
  });

  it("returns 201 only after the registration transaction resolves", async () => {
    const order: string[] = [];
    mocks.registerGymOwner.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 10));
      order.push("transaction");
      return { gym: { id: "gym_new", name: valid.gymName, slug: valid.gymSlug }, member: { id: "mem_new" } };
    });
    const res = await POST(post(valid));
    order.push("respond");
    expect(res.status).toBe(201);
    expect(order).toEqual(["transaction", "respond"]);
  });

  it("a session failure still reports success and directs the owner to sign in", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.createSession.mockRejectedValue(new Error("cookie store unavailable"));
    const res = await POST(post(valid));
    // The academy is committed: never imply it can be created again.
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.code).toBe("SESSION_NOT_CREATED");
    expect(body.signInRequired).toBe(true);
    expect(body.error).toMatch(/sign in/i);
    expect(body.gym.slug).toBe(valid.gymSlug);
    spy.mockRestore();
  });
});

describe("POST /api/auth/register — rejections", () => {
  it("denies registration from the native shell (UA and cookie)", async () => {
    const byUa = await POST(post(valid, { "user-agent": "MatFlowNative/1.0" }));
    expect(byUa.status).toBe(403);
    expect((await byUa.json()).code).toBe("NATIVE_NOT_SUPPORTED");
    expect(mocks.registerGymOwner).not.toHaveBeenCalled();

    const byCookie = await POST(post(valid, { cookie: "matflow-native=1" }));
    expect(byCookie.status).toBe(403);
    expect(mocks.registerGymOwner).not.toHaveBeenCalled();
  });

  it("returns 400 with a field for each validation failure and never touches the database", async () => {
    const cases: { patch: Record<string, unknown>; field: string }[] = [
      { patch: { firstName: "" }, field: "firstName" },
      { patch: { email: "nope" }, field: "email" },
      { patch: { password: "12345" }, field: "password" },
      { patch: { gymName: "  " }, field: "gymName" },
      { patch: { gymSlug: "ab" }, field: "gymSlug" },
      { patch: { timezone: "Mars/Olympus" }, field: "timezone" },
    ];
    for (const { patch, field } of cases) {
      const res = await POST(post({ ...valid, ...patch }));
      expect(res.status, JSON.stringify(patch)).toBe(400);
      const body = await res.json();
      expect(body.field).toBe(field);
      expect(typeof body.code).toBe("string");
    }
    expect(mocks.registerGymOwner).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed JSON, not 500", async () => {
    const res = await POST(post("{nope"));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_BODY");
    expect(mocks.registerGymOwner).not.toHaveBeenCalled();
  });

  it("returns 409 for a duplicate email and a duplicate slug", async () => {
    mocks.registerGymOwner.mockRejectedValue(new DuplicateRegistrationError("email", "An account with this email already exists"));
    const dupEmail = await POST(post(valid));
    expect(dupEmail.status).toBe(409);
    expect(await dupEmail.json()).toMatchObject({ code: "EMAIL_TAKEN", field: "email" });

    mocks.registerGymOwner.mockRejectedValue(new DuplicateRegistrationError("gymSlug", "This gym URL is already taken"));
    const dupSlug = await POST(post(valid));
    expect(dupSlug.status).toBe(409);
    expect(await dupSlug.json()).toMatchObject({ code: "SLUG_TAKEN", field: "gymSlug" });
    // No session for a rejected registration.
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it("never exposes a raw database error", async () => {
    const prismaError = Object.assign(new Error('Invalid `prisma.gym.create()` invocation: column "x"'), { code: "P2010" });
    mocks.registerGymOwner.mockRejectedValue(prismaError);
    const res = await POST(post(valid));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.code).toBe("REGISTRATION_FAILED");
    expect(JSON.stringify(body)).not.toMatch(/prisma|invocation|column/i);
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it("a concurrent duplicate submission yields one success and one 409, never two academies", async () => {
    // First call wins; the second loses the unique-constraint race, which
    // registerGymOwner maps to a DuplicateRegistrationError.
    let calls = 0;
    mocks.registerGymOwner.mockImplementation(async () => {
      calls += 1;
      if (calls === 1) return { gym: { id: "gym_new", name: valid.gymName, slug: valid.gymSlug }, member: { id: "mem_new" } };
      throw new DuplicateRegistrationError("gymSlug", "This gym URL is already taken");
    });
    const [a, b] = await Promise.all([POST(post(valid)), POST(post(valid))]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([201, 409]);
    // Exactly one academy and one session.
    expect(mocks.createSession).toHaveBeenCalledTimes(1);
  });

  it("never logs the password or the full payload", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.registerGymOwner.mockRejectedValue(Object.assign(new Error("boom"), { code: "P2010" }));
    await POST(post(valid));
    const logged = JSON.stringify(spy.mock.calls);
    expect(logged).not.toContain(valid.password);
    expect(logged).not.toContain(valid.email);
    spy.mockRestore();
  });
});
