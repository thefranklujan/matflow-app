/**
 * One email address, one identity creator at a time (Codex round 2,
 * finding 2). Every unauthenticated path that creates an identity (owner
 * registration, student sign-up, the join link) and password reset take this
 * per-address transaction lock, then check BOTH tables inside it. Without it an
 * owner registration could create a Member on an address that already belongs
 * to a Student (or race a concurrent sign-up for the same address), giving one
 * address two unrelated identities.
 */
import type { Prisma, PrismaClient } from "@prisma/client";

type Tx = Prisma.TransactionClient | PrismaClient;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Serialize identity writes for this address until the transaction ends. */
export async function lockIdentityEmail(tx: Prisma.TransactionClient, email: string): Promise<void> {
  const key = `identity:${normalizeEmail(email)}`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
}

/** True when a Student or any Member row (any gym) already uses the address. */
export async function emailInUse(tx: Tx, email: string): Promise<boolean> {
  const insensitive = { equals: normalizeEmail(email), mode: "insensitive" as const };
  const [student, member] = await Promise.all([
    tx.student.findFirst({ where: { email: insensitive }, select: { id: true } }),
    tx.member.findFirst({ where: { email: insensitive }, select: { id: true } }),
  ]);
  return !!student || !!member;
}
