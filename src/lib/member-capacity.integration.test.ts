/**
 * REAL-Postgres concurrency tests for the member-capacity service (no mocks).
 * Uses the local throwaway dev database from .env.local (localhost:5544) and
 * skips cleanly when it is not running (e.g. CI without Postgres).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { PrismaClient, type Prisma } from "@prisma/client";
import { lockMemberCapacity, assertSeatAvailable, MemberLimitError } from "./member-capacity";

function localDbUrl(): string | null {
  try {
    const env = readFileSync(join(__dirname, "../../.env.local"), "utf8");
    const m = env.match(/^DATABASE_URL=("?)(.+?)\1$/m);
    const url = m?.[2] ?? null;
    // Safety: integration tests may only ever touch the local throwaway DB.
    if (url && /localhost|127\.0\.0\.1/.test(url)) return url;
    return null;
  } catch {
    return null;
  }
}

const url = localDbUrl();
let prisma: PrismaClient | null = null;
let dbUp = false;
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
  prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbUp = true;
  } catch {
    dbUp = false;
    return;
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
});

describe.skipIf(!url)("member capacity under real concurrency (local Postgres)", () => {
  it("four concurrent joins at 98/100 admit exactly two — never member 101", async () => {
    if (!dbUp) return expect(dbUp, "local dev DB not running — start pg on :5544 to run this").toBe(false);
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
    if (!dbUp) return;
    expect(await join1Seat(prisma!)).toBe("limit");
    expect(await prisma!.member.count({ where: { gymId: GYM_ID, active: true } })).toBe(100);
  }, 15_000);

  it("Pro (unlimited) gyms are not capped", async () => {
    if (!dbUp) return;
    process.env.STRIPE_PRO_PRICE_ID = "price_pro_integration";
    await prisma!.gym.update({
      where: { id: GYM_ID },
      data: { subscriptionStatus: "active", stripePriceId: "price_pro_integration", trialEndsAt: null },
    });
    expect(await join1Seat(prisma!)).toBe("ok"); // member 101 allowed on Pro
    const active = await prisma!.member.count({ where: { gymId: GYM_ID, active: true } });
    expect(active).toBe(101);
  }, 15_000);
});
