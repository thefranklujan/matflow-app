/**
 * Who owns a gym. The owner is identified by the registration marker that
 * registerGymOwner() writes into Member.clerkUserId ("owner-<uuid>"), or the
 * demo owner's "demo-owner-<ts>"), never by row age alone.
 *
 * Previously "admin" meant "the oldest Member row of the gym", so deleting the
 * owner's row silently promoted the next-oldest student to admin (with billing
 * access). Self-join paths write their own prefixes ("member-", "student-",
 * "dropin-"), so those rows can never be resolved as the owner.
 *
 * Legacy fallback: a gym with no marked owner (rows created before the marker
 * existed, or fixtures) resolves to its oldest member that was NOT created by a
 * self-join path. It never promotes a self-joined member.
 */
import { prisma } from "@/lib/prisma";
import type { Prisma, PrismaClient } from "@prisma/client";

export const OWNER_MARKER_PREFIXES = ["owner-", "demo-owner-"] as const;
const SELF_JOIN_PREFIXES = ["member-", "student-", "dropin-"] as const;

type Client = PrismaClient | Prisma.TransactionClient;

export function hasOwnerMarker(clerkUserId: string | null | undefined): boolean {
  return !!clerkUserId && OWNER_MARKER_PREFIXES.some((p) => clerkUserId.startsWith(p));
}

/** The gym's owner Member row, or null when the gym has none. */
export async function findGymOwner<S extends Prisma.MemberSelect>(
  gymId: string,
  select?: S,
  client: Client = prisma,
) {
  const marked = await client.member.findFirst({
    where: { gymId, OR: OWNER_MARKER_PREFIXES.map((p) => ({ clerkUserId: { startsWith: p } })) },
    orderBy: { createdAt: "asc" },
    ...(select ? { select } : {}),
  });
  if (marked) return marked;
  return client.member.findFirst({
    where: { gymId, NOT: SELF_JOIN_PREFIXES.map((p) => ({ clerkUserId: { startsWith: p } })) },
    orderBy: { createdAt: "asc" },
    ...(select ? { select } : {}),
  });
}

export async function findGymOwnerId(gymId: string, client: Client = prisma): Promise<string | null> {
  const owner = await findGymOwner(gymId, { id: true }, client);
  return (owner as { id: string } | null)?.id ?? null;
}

export async function isGymOwner(member: { id: string; gymId: string }, client: Client = prisma) {
  return (await findGymOwnerId(member.gymId, client)) === member.id;
}
