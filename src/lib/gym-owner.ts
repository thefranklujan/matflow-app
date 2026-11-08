/**
 * Who owns a gym. The owner is the Member row carrying the registration
 * marker registerGymOwner() writes into clerkUserId ("owner-<uuid>"; the demo
 * owner's "demo-owner-<ts>"), or the explicit Member.isOwner flag (set at
 * registration, and for rows that predate the marker only by the reviewed
 * backfill). Never by row age.
 *
 * Previously "admin" meant "the oldest Member row of the gym", so deleting the
 * owner's row silently promoted the next-oldest member to admin, with billing
 * access (audit M6, owner-features finding 4). A gym with neither a marker nor
 * a flag has NO owner: it fails closed until the backfill names one (Codex
 * round 1, finding 1).
 */
import { prisma } from "@/lib/prisma";
import type { Prisma, PrismaClient } from "@prisma/client";

export const OWNER_MARKER_PREFIXES = ["owner-", "demo-owner-"] as const;

type Client = PrismaClient | Prisma.TransactionClient;

export function hasOwnerMarker(clerkUserId: string | null | undefined): boolean {
  return !!clerkUserId && OWNER_MARKER_PREFIXES.some((p) => clerkUserId.startsWith(p));
}

/** Prisma filter for "this row is a gym owner". */
export const OWNER_WHERE: Prisma.MemberWhereInput = {
  OR: [{ isOwner: true }, ...OWNER_MARKER_PREFIXES.map((p) => ({ clerkUserId: { startsWith: p } }))],
};

/** The gym's owner Member row, or null when the gym has none. */
export async function findGymOwner<S extends Prisma.MemberSelect>(
  gymId: string,
  select?: S,
  client: Client = prisma,
) {
  return client.member.findFirst({
    where: { gymId, ...OWNER_WHERE },
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
