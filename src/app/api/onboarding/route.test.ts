import { describe, it, expect, vi } from "vitest";

// Any Prisma access at all would be a defect: the retired endpoint must not
// touch the database, so every model method throws if called.
const forbidden = () => {
  throw new Error("PRISMA WAS CALLED BY THE RETIRED ONBOARDING ENDPOINT");
};
vi.mock("@/lib/prisma", () => ({
  prisma: new Proxy(
    {},
    {
      get: () => new Proxy({}, { get: () => forbidden }),
    },
  ),
}));
vi.mock("@/lib/local-auth", () => ({ getSession: forbidden }));

import { POST } from "./route";

describe("POST /api/onboarding — retired", () => {
  it("answers 410 with a stable code and a safe message", async () => {
    const res = await POST();
    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.code).toBe("ONBOARDING_RETIRED");
    expect(typeof body.error).toBe("string");
    expect(body.error).toMatch(/sign-up/i);
    // No internals leak.
    expect(JSON.stringify(body)).not.toMatch(/prisma|stack|gymId|clerkOrgId/i);
  });

  it("performs zero database work and reads no session", async () => {
    // The mocks above throw on ANY access; reaching 410 twice proves neither
    // Prisma nor the session helper was touched.
    for (let i = 0; i < 2; i++) {
      const res = await POST();
      expect(res.status).toBe(410);
    }
  });
});
