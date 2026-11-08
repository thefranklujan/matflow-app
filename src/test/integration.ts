/**
 * Shared harness for the Phase 0 security regression suites.
 *
 * Route handlers, server components and middleware run UNMODIFIED against the
 * approved local throwaway Postgres (test-db-safety gate: localhost + approved
 * database name + ALLOW_TEST_DB_MUTATION=1). Only two seams are replaced:
 *   - next/headers: an in-memory cookie jar standing in for the browser.
 *   - @/lib/email: spies, so nothing is ever sent.
 *
 * Each test file must declare the mocks itself (vi.mock is hoisted per file):
 *
 *   vi.mock("next/headers", async () => (await import("@/test/integration")).nextHeadersMock);
 *   vi.mock("@/lib/prisma", async () => ({ prisma: (await import("@/test/integration")).testPrisma }));
 *   vi.mock("@/lib/email", async () => (await import("@/test/integration")).emailMock);
 *
 * Fixture identities: gym ids start with "p0t-", emails end "@p0.matflow.test".
 * cleanupFixtures() removes only the rows the calling file registered.
 */
import { join } from "path";
import { randomUUID } from "crypto";
import { vi } from "vitest";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";
import { safeTestDbFromEnvFile } from "@/lib/test-db-safety";

export const safeDb = safeTestDbFromEnvFile(join(__dirname, "../.."));
export const testPrisma: PrismaClient | null = safeDb
  ? new PrismaClient({ datasources: { db: { url: safeDb.url } } })
  : null;
export const dbConfigured = !!testPrisma;

export function db(): PrismaClient {
  if (!testPrisma) throw new Error("integration DB not configured (set TEST_DATABASE_URL)");
  return testPrisma;
}

// ── Cookie jar (next/headers) ─────────────────────────────────────────────

export const jar = new Map<string, string>();
type CookieArg = string | { name: string; value?: string };
const cookieStore = {
  get: (name: CookieArg) => {
    const n = typeof name === "string" ? name : name.name;
    return jar.has(n) ? { name: n, value: jar.get(n)! } : undefined;
  },
  getAll: () => [...jar].map(([name, value]) => ({ name, value })),
  has: (name: string) => jar.has(name),
  set: (name: CookieArg, value?: string) => {
    if (typeof name === "string") jar.set(name, value ?? "");
    else jar.set(name.name, name.value ?? "");
  },
  delete: (name: CookieArg) => {
    jar.delete(typeof name === "string" ? name : name.name);
  },
};
export const nextHeadersMock = {
  cookies: async () => cookieStore,
  headers: async () => new Headers(),
};

// ── Email spies ───────────────────────────────────────────────────────────

export const emailMock = {
  sendWelcomeEmail: vi.fn(),
  sendOrderConfirmation: vi.fn(),
  sendBeltPromotion: vi.fn(),
  sendTrialExpiring: vi.fn(),
  sendClassReminder: vi.fn(),
  sendJoinRequestSubmittedToAdmin: vi.fn(),
  sendJoinRequestApprovedToStudent: vi.fn(),
  notifyFrankNewGymPending: vi.fn(),
  notifyAdminOfNewStudent: vi.fn(),
  sendWeeklyRecap: vi.fn(),
  sendGymApprovedEmail: vi.fn(),
  sendJoinRequestRejectedToStudent: vi.fn(),
  sendAnnouncementEmail: vi.fn(),
  sendPasswordReset: vi.fn(),
  sendEmail: vi.fn(),
};

// ── Requests ──────────────────────────────────────────────────────────────

export function req(
  path: string,
  opts: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
): NextRequest {
  const cookie = [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
  return new NextRequest(`http://localhost${path}`, {
    method: opts.method ?? (opts.body ? "POST" : "GET"),
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
      ...(opts.headers ?? {}),
    },
  });
}

export const params = <T extends Record<string, string>>(p: T) => ({ params: Promise.resolve(p) });

/** Decode (without verifying) the session JWT currently in the jar. */
export function sessionClaims(): Record<string, unknown> | null {
  const token = jar.get("matflow-session");
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

/** Next.js navigation errors carry a digest: NEXT_REDIRECT;... or NEXT_HTTP_ERROR_FALLBACK;404 */
export async function navigationOutcome(p: Promise<unknown>): Promise<"rendered" | "redirect" | "notFound" | "error"> {
  try {
    await p;
    return "rendered";
  } catch (err) {
    const digest = String((err as { digest?: string })?.digest ?? "");
    if (digest.startsWith("NEXT_REDIRECT")) return "redirect";
    if (digest.includes(";404")) return "notFound";
    return "error";
  }
}

// ── Fixtures ──────────────────────────────────────────────────────────────

export const PASSWORD = "Fixture-Passw0rd-p0";
let hashCache: string | null = null;
export async function fixtureHash() {
  hashCache ??= await bcrypt.hash(PASSWORD, 4);
  return hashCache;
}

export const tag = () => randomUUID().slice(0, 8);

// Vitest isolates modules per test file, so this registry is per file: a
// file's cleanup never touches fixtures another (parallel) file created.
const created = { gyms: new Set<string>(), emails: new Set<string>() };
export function trackEmail(addr: string) {
  created.emails.add(addr.toLowerCase());
  return addr;
}
export const email = (local: string) => trackEmail(`${local}-${tag()}@p0.matflow.test`);

export async function makeGym(over: Record<string, unknown> = {}) {
  const t = tag();
  created.gyms.add(`p0t-${t}`);
  return db().gym.create({
    data: {
      id: `p0t-${t}`,
      clerkOrgId: `p0t-org-${t}`,
      name: `P0 Test Gym ${t}`,
      slug: `p0t-${t}`,
      subscriptionStatus: "trialing",
      trialEndsAt: new Date(Date.now() + 20 * 24 * 3600 * 1000),
      approved: true,
      ...over,
    },
  });
}

export async function makeOwner(gymId: string, over: Record<string, unknown> = {}) {
  return db().member.create({
    data: {
      gymId,
      clerkUserId: `owner-${randomUUID()}`,
      email: email("owner"),
      firstName: "Olive",
      lastName: "Owner",
      passwordHash: await fixtureHash(),
      beltRank: "black",
      ...over,
    },
  });
}

/** A Student identity plus an approved, active Member row at gymId (the join-link shape). */
export async function makeStudentMember(gymId: string, over: { member?: Record<string, unknown>; student?: Record<string, unknown> } = {}) {
  const addr = email("student");
  const student = await db().student.create({
    data: { email: addr, firstName: "Sam", lastName: "Student", passwordHash: await fixtureHash(), ...over.student },
  });
  const member = await db().member.create({
    data: {
      gymId,
      clerkUserId: `member-${randomUUID()}`,
      email: addr,
      firstName: "Sam",
      lastName: "Student",
      studentId: student.id,
      ...over.member,
    },
  });
  return { student, member };
}

export function trackGym(id: string) {
  created.gyms.add(id);
  return id;
}

/** Deletes only what THIS test file created (gyms cascade their members). */
export async function cleanupFixtures() {
  if (!testPrisma) return;
  const gyms = [...created.gyms];
  const emails = [...created.emails];
  await testPrisma.gym.deleteMany({ where: { id: { in: gyms } } });
  await testPrisma.member.deleteMany({ where: { email: { in: emails, mode: "insensitive" } } });
  await testPrisma.student.deleteMany({ where: { email: { in: emails, mode: "insensitive" } } });
}
