import { join } from "path";
import { PrismaClient } from "@prisma/client";
import { safeTestDbFromEnvFile, type SafeTestDb } from "./test-db-safety";

/**
 * Shared REAL-Postgres client for integration suites that exercise app code
 * importing the `@/lib/prisma` singleton. Suites swap the singleton for this
 * client with:
 *
 *   vi.mock("@/lib/prisma", async () => ({
 *     prisma: (await import("@/lib/test-integration-prisma")).integrationPrisma(),
 *   }));
 *
 * The URL always comes from the central safety gate (exact localhost host,
 * approved database name, ALLOW_TEST_DB_MUTATION=1). When nothing is
 * configured the client points at an unroutable placeholder and suites must
 * skip via `integrationDb() === null`; a configured-but-unsafe URL throws.
 */

let cached: { db: SafeTestDb | null; client: PrismaClient } | null = null;

export function integrationDb(): SafeTestDb | null {
  return resolve().db;
}

export function integrationPrisma(): PrismaClient {
  return resolve().client;
}

function resolve() {
  if (cached) return cached;
  const db = safeTestDbFromEnvFile(join(__dirname, "../.."));
  const url = db?.url ?? "postgresql://unconfigured@localhost:1/matflow_test";
  cached = { db, client: new PrismaClient({ datasources: { db: { url } } }) };
  return cached;
}
