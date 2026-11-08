/**
 * Phase 0, items 6, 7 and 9:
 *  6. Crons were redirected to /sign-in by middleware (audit H2), and an unset
 *     CRON_SECRET matched the literal "Bearer undefined".
 *  7. The dead kiosk was public, and the unsold commerce surface was in the
 *     owner nav and storefront (owner-features findings 7 and 12).
 *  9. No rate limiting on auth, leads or drop-in, and 6-character passwords
 *     (audit H4).
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";

vi.mock("next/headers", async () => (await import("@/test/integration")).nextHeadersMock);
vi.mock("@/lib/prisma", async () => ({ prisma: (await import("@/test/integration")).testPrisma }));
vi.mock("@/lib/email", async () => (await import("@/test/integration")).emailMock);
vi.mock("@/lib/push", () => ({ notify: vi.fn(async () => {}) }));

import { dbConfigured, jar, req, params, navigationOutcome, cleanupFixtures, makeGym, email } from "@/test/integration";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";
import { NAV_ITEMS, NAV_GROUP_ORDER } from "@/lib/nav-items";
import { GET as trialExpiring } from "@/app/api/cron/trial-expiring/route";
import { GET as classReminders } from "@/app/api/cron/class-reminders/route";
import { GET as kioskGet, POST as kioskPost } from "@/app/api/kiosk/[slug]/route";
import KioskPage from "@/app/kiosk/[slug]/page";
import { POST as createOrder } from "@/app/api/orders/route";
import { POST as join } from "@/app/api/auth/join/route";
import { POST as studentSignup } from "@/app/api/auth/student-signup/route";
import { POST as resetPassword } from "@/app/api/auth/reset-password/route";
import { validateOwnerRegistration } from "@/lib/owner-registration";

let ipSeq = 0;
function mw(path: string, opts: { cookie?: boolean; method?: string; ip?: string; headers?: Record<string, string> } = {}) {
  return middleware(new NextRequest(`http://localhost${path}`, {
    method: opts.method ?? "GET",
    headers: {
      ...(opts.cookie ? { cookie: "matflow-session=x" } : {}),
      "x-forwarded-for": opts.ip ?? `10.9.${Math.floor(++ipSeq / 250)}.${ipSeq % 250}`,
      ...(opts.headers ?? {}),
    },
  }));
}
// Handlers are called with the arguments the PRE-fix signatures took, so the
// same suite ran red against the old code (the new handlers ignore them).
const call = (fn: unknown, ...args: unknown[]) => (fn as (...a: unknown[]) => Promise<Response>)(...args);
const passes = (res: Response) => res.headers.get("x-middleware-next") === "1";
const location = (res: Response) => new URL(res.headers.get("location")!).pathname;

describe("6. Crons reach their handlers and fail closed", () => {
  it("middleware lets Vercel Cron (no cookie) through to /api/cron/*", () => {
    expect(passes(mw("/api/cron/trial-expiring", { headers: { authorization: "Bearer x" } }))).toBe(true);
    expect(passes(mw("/api/cron/class-reminders"))).toBe(true);
  });

  it("an unset CRON_SECRET refuses even the literal 'Bearer undefined'", async () => {
    delete process.env.CRON_SECRET;
    const h = { authorization: "Bearer undefined" };
    expect((await trialExpiring(req("/api/cron/trial-expiring", { headers: h }))).status).toBe(401);
    expect((await classReminders(req("/api/cron/class-reminders", { headers: h }))).status).toBe(401);
  });

  it("a wrong secret is refused", async () => {
    process.env.CRON_SECRET = "right";
    expect((await trialExpiring(req("/api/cron/trial-expiring", { headers: { authorization: "Bearer wrong" } }))).status).toBe(401);
    delete process.env.CRON_SECRET;
  });
});

describe("7. Kiosk and commerce are off", () => {
  it("/kiosk and /api/kiosk are no longer public", () => {
    expect(location(mw("/kiosk/some-gym"))).toBe("/sign-in");
    expect(location(mw("/api/kiosk/some-gym"))).toBe("/sign-in");
  });

  it("the kiosk API and page answer 404 even for a real gym", async () => {
    let slug = "p0-no-gym";
    if (dbConfigured) slug = (await makeGym()).slug;
    expect((await call(kioskGet, req(`/api/kiosk/${slug}`), params({ slug }))).status).toBe(404);
    expect((await call(kioskPost, req(`/api/kiosk/${slug}`, { body: { code: "123456" } }), params({ slug }))).status).toBe(404);
    expect(await navigationOutcome(Promise.resolve().then(() => call(KioskPage, params({ slug }))))).toBe("notFound");
  });

  it("the owner nav has no Commerce group", () => {
    expect(NAV_GROUP_ORDER as string[]).not.toContain("Commerce");
    const slugs = NAV_ITEMS.map((i) => i.slug);
    for (const s of ["products", "orders", "inventory"]) expect(slugs).not.toContain(s);
  });

  it("commerce pages redirect to /app (owner and storefront)", () => {
    for (const p of ["/app/products", "/app/products/abc/edit", "/app/orders", "/app/inventory", "/products", "/products/gi", "/cart", "/checkout", "/categories/gear"]) {
      const res = mw(p, { cookie: true });
      expect(res.status, p).toBe(307);
      expect(location(res), p).toBe("/app");
    }
  });

  it("POST /api/orders answers 410 Gone", async () => {
    const res = await call(createOrder, req("/api/orders", { body: { items: [] } }));
    expect(res.status).toBe(410);
  });
});

describe("9. Rate limits and password length", () => {
  beforeEach(() => jar.clear());
  afterAll(cleanupFixtures);

  it("POSTs to /api/auth/* are limited per client and answer 429 with Retry-After", () => {
    const ip = "203.0.113.7";
    let last: Response | null = null;
    for (let i = 0; i < 40; i++) last = mw("/api/auth/login", { method: "POST", ip });
    expect(last!.status).toBe(429);
    expect(Number(last!.headers.get("retry-after"))).toBeGreaterThan(0);
    // Another client is unaffected.
    expect(passes(mw("/api/auth/login", { method: "POST", ip: "203.0.113.8" }))).toBe(true);
  });

  it("forgot-password has a tighter limit", () => {
    const ip = "203.0.113.9";
    const statuses = Array.from({ length: 8 }, () => mw("/api/auth/forgot-password", { method: "POST", ip }).status);
    expect(statuses).toContain(429);
  });

  it("/api/leads and /api/dropin/* are limited too", () => {
    for (const path of ["/api/leads", "/api/dropin/some-gym"]) {
      const ip = `198.51.100.${path.length}`;
      let last: Response | null = null;
      for (let i = 0; i < 40; i++) last = mw(path, { method: "POST", ip });
      expect(last!.status, path).toBe(429);
    }
  });

  it("GETs are not limited", () => {
    const ip = "203.0.113.20";
    for (let i = 0; i < 60; i++) expect(mw("/api/auth/session", { ip }).status).not.toBe(429);
  });

  it("all four password checks require at least 10 characters", async () => {
    const nine = "Abcdefg1!";
    const join9 = await join(req("/api/auth/join", { body: { firstName: "A", lastName: "B", email: email("pw"), password: nine, gymSlug: "x" } }));
    expect(join9.status).toBe(400);
    const signup9 = await studentSignup(req("/api/auth/student-signup", { body: { firstName: "A", lastName: "B", email: email("pw"), password: nine } }));
    expect(signup9.status).toBe(400);
    const reset9 = await resetPassword(req("/api/auth/reset-password", { body: { token: "t", password: nine } }));
    expect(reset9.status).toBe(400);
    expect((await reset9.json()).error).toMatch(/10/);
    const owner = validateOwnerRegistration({
      firstName: "A", lastName: "B", email: "a@b.co", password: nine, gymName: "Gym", gymSlug: "gym-slug",
    } as never);
    expect(owner.ok).toBe(false);
  });
});

beforeAll(() => {
  // Rate-limit tests must not inherit a disabled limiter from the environment.
  delete process.env.RATE_LIMIT_DISABLED;
});
