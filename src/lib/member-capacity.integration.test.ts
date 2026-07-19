/**
 * REAL-Postgres concurrency tests for the member-capacity service (no mocks).
 * Uses the local throwaway dev database from .env.local (localhost:5544) and
 * skips cleanly when it is not running (e.g. CI without Postgres).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { join } from "path";
import { safeTestDbFromEnvFile } from "./test-db-safety";
import { PrismaClient, type Prisma } from "@prisma/client";
import { lockMemberCapacity, assertSeatAvailable, MemberLimitError } from "./member-capacity";

// Central URL-parsing safety gate (no regex): throws on a configured-but-
// unapproved URL, returns null only when nothing is configured.
const safeDb = safeTestDbFromEnvFile(join(__dirname, "../.."));
const url = safeDb?.url ?? null;
let prisma: PrismaClient | null = null;
let dbUp = false;
let savedProPriceId: string | undefined;
const GYM_ID = "cap-test-gym";

async function join1Seat(client: PrismaClient): Promise<"ok" | "limit"> {
  try {
    await client.$transaction(async (tx: Prisma.TransactionClient) => {
      await lockMemberCapacity(tx, GYM_ID);
      await assertSeatAvailable(tx, GYM_ID);
      await tx.member.create({
        data: {
          gymId: GYM_ID,
          clerkUserId: `cap-${Date.now()}-${Math.random()}`,
          email: `cap-${Date.now()}-${Math.random()}@test.local`,
          firstName: "Cap",
          lastName: "Test",
          active: true,
          approved: true,
        },
      });
    });
    return "ok";
  } catch (err) {
    if (err instanceof MemberLimitError) return "limit";
    throw err;
  }
}

beforeAll(async () => {
  if (!url) return;
  savedProPriceId = process.env.STRIPE_PRO_PRICE_ID;
  prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbUp = true;
    // Unmistakable proof in the runner output that the REAL database ran.
    console.log("[member-capacity.integration] REAL POSTGRES CONNECTED — concurrency proofs executing against", url.replace(/\/\/[^@]*@/, "//<redacted>@"));
  } catch {
    // A safe local DATABASE_URL IS configured but the database is down. A
    // silent pass here would be a false green — fail the suite loudly.
    throw new Error(
      "member-capacity integration: local DATABASE_URL is configured but unreachable. " +
      "Start the dev database (pg_ctl -D ~/.matflow-devdb -o \"-p 5544\" start) or remove the URL.",
    );
  }
  // Fresh Basic-trial gym at 98/100 active members.
  await prisma.gym.deleteMany({ where: { id: GYM_ID } });
  await prisma.gym.create({
    data: {
      id: GYM_ID,
      clerkOrgId: `cap-test-${Date.now()}`,
      name: "Capacity Test Gym",
      slug: `cap-test-${Date.now()}`,
      subscriptionStatus: "trialing",
      trialEndsAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      approved: true,
    },
  });
  await prisma.member.createMany({
    data: Array.from({ length: 98 }, (_, i) => ({
      gymId: GYM_ID,
      clerkUserId: `cap-seed-${i}`,
      email: `cap-seed-${i}@test.local`,
      firstName: "Seed",
      lastName: `M${i}`,
      active: true,
      approved: true,
    })),
  });
}, 30_000);

afterAll(async () => {
  if (prisma && dbUp) {
    await prisma.gym.deleteMany({ where: { id: GYM_ID } });
  }
  await prisma?.$disconnect();
  // Never leak env mutation into other suites.
  if (savedProPriceId === undefined) delete process.env.STRIPE_PRO_PRICE_ID;
  else process.env.STRIPE_PRO_PRICE_ID = savedProPriceId;
});

describe.skipIf(!url)("member capacity under real concurrency (local Postgres)", () => {
  it("four concurrent joins at 98/100 admit exactly two — never member 101", async () => {
    expect(dbUp, "real-Postgres setup must have run").toBe(true);
    const results = await Promise.all([
      join1Seat(prisma!),
      join1Seat(prisma!),
      join1Seat(prisma!),
      join1Seat(prisma!),
    ]);
    const admitted = results.filter((r) => r === "ok").length;
    const limited = results.filter((r) => r === "limit").length;
    expect(admitted).toBe(2);
    expect(limited).toBe(2);
    const active = await prisma!.member.count({ where: { gymId: GYM_ID, active: true } });
    expect(active).toBe(100); // hard cap held under concurrency
  }, 30_000);

  it("a further join at 100/100 is rejected", async () => {
    expect(dbUp, "real-Postgres setup must have run").toBe(true);
    expect(await join1Seat(prisma!)).toBe("limit");
    expect(await prisma!.member.count({ where: { gymId: GYM_ID, active: true } })).toBe(100);
  }, 15_000);

  it("Pro (unlimited) gyms are not capped", async () => {
    expect(dbUp, "real-Postgres setup must have run").toBe(true);
    process.env.STRIPE_PRO_PRICE_ID = "price_pro_integration";
    await prisma!.gym.update({
      where: { id: GYM_ID },
      data: { subscriptionStatus: "active", stripePriceId: "price_pro_integration", trialEndsAt: null },
    });
    expect(await join1Seat(prisma!)).toBe("ok"); // member 101 allowed on Pro
    const active = await prisma!.member.count({ where: { gymId: GYM_ID, active: true } });
    expect(active).toBe(101);
  }, 15_000);

  it("reactivation: concurrent duplicates are idempotent; in-lock re-read charges one seat", async () => {
    expect(dbUp, "real-Postgres setup must have run").toBe(true);
    // Back to Basic; deactivate two members -> 99 active, M1 & M2 inactive.
    await prisma!.gym.update({
      where: { id: GYM_ID },
      data: { subscriptionStatus: "trialing", stripePriceId: null, trialEndsAt: new Date(Date.now() + 7 * 24 * 3600 * 1000) },
    });
    const inactive = await prisma!.member.findMany({ where: { gymId: GYM_ID }, take: 2, orderBy: { clerkUserId: "asc" } });
    await prisma!.member.updateMany({ where: { id: { in: inactive.map((m) => m.id) } }, data: { active: false } });
    expect(await prisma!.member.count({ where: { gymId: GYM_ID, active: true } })).toBe(99);
    const [m1, m2] = inactive;

    // Mirrors the members/[id] route: lock -> re-read THIS member -> seat
    // check only if still inactive -> update. (The route runs identical code.)
    async function reactivate(memberId: string): Promise<"ok" | "limit"> {
      try {
        await prisma!.$transaction(async (tx: Prisma.TransactionClient) => {
          await lockMemberCapacity(tx, GYM_ID);
          const current = await tx.member.findFirst({ where: { id: memberId, gymId: GYM_ID } });
          if (!current) throw new Error("gone");
          if (!current.active) await assertSeatAvailable(tx, GYM_ID);
          await tx.member.update({ where: { id: memberId }, data: { active: true } });
        });
        return "ok";
      } catch (err) {
        if (err instanceof MemberLimitError) return "limit";
        throw err;
      }
    }

    // Two CONCURRENT reactivations of the SAME member: the loser of the lock
    // re-reads an already-active row, skips the seat check, and no-ops.
    const dup = await Promise.all([reactivate(m1.id), reactivate(m1.id)]);
    expect(dup).toEqual(["ok", "ok"]);
    expect(await prisma!.member.count({ where: { gymId: GYM_ID, active: true } })).toBe(100);

    // The gym is now full again: a DIFFERENT member cannot be reactivated.
    expect(await reactivate(m2.id)).toBe("limit");
    expect(await prisma!.member.count({ where: { gymId: GYM_ID, active: true } })).toBe(100);
  }, 30_000);
});
