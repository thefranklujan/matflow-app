/**
 * Password recovery by email address. A reset link proves control of the
 * inbox, so it resets EVERY identity that uses the address (the Student and
 * each password-bearing Member row, in any gym), which keeps recovery and
 * login in agreement (Codex round 1, finding 3). Before this, recovery reset
 * whichever single row an unordered lookup returned, preferring a Student, so
 * a shadow Student registered under C1 received the reset while the real
 * owner's password stayed unchanged.
 *
 * The token carries a fingerprint of every current password hash for the
 * address: any password change for any of them invalidates outstanding links.
 * reset-password re-reads and compares the fingerprint and writes the new
 * hashes in ONE transaction under the per-address identity lock, so two
 * concurrent uses of the same link cannot both succeed (Codex round 2,
 * finding 3).
 */
import { createHash } from "crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hasOwnerMarker } from "@/lib/gym-owner";

export interface EmailIdentities {
  student: { id: string; firstName: string; email: string; passwordHash: string } | null;
  members: { id: string; firstName: string; email: string; passwordHash: string | null; isPlatformAdmin: boolean; isOwner: boolean; clerkUserId: string }[];
}

export async function identitiesForEmail(
  emailLower: string,
  client: PrismaClient | Prisma.TransactionClient = prisma,
): Promise<EmailIdentities> {
  const insensitive = { equals: emailLower, mode: "insensitive" as const };
  const [student, members] = await Promise.all([
    client.student.findFirst({
      where: { email: insensitive },
      select: { id: true, firstName: true, email: true, passwordHash: true },
    }),
    client.member.findMany({
      where: { email: insensitive },
      select: { id: true, firstName: true, email: true, passwordHash: true, isPlatformAdmin: true, isOwner: true, clerkUserId: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  return { student, members };
}

/** True when at least one identity can sign in with a password today. */
export function hasPasswordIdentity(ids: EmailIdentities): boolean {
  return !!ids.student?.passwordHash || ids.members.some((m) => !!m.passwordHash);
}

/** Display name for the email: the privileged member, else the student, else any member. */
export function recoveryName(ids: EmailIdentities): string {
  const privileged = ids.members.find((m) => m.isPlatformAdmin || m.isOwner || hasOwnerMarker(m.clerkUserId));
  return privileged?.firstName ?? ids.student?.firstName ?? ids.members[0]?.firstName ?? "there";
}

/** Changes whenever any password for the address changes (single-use links). */
export function identitiesFingerprint(ids: EmailIdentities): string {
  const parts = [
    ...(ids.student ? [`s:${ids.student.id}:${ids.student.passwordHash}`] : []),
    ...ids.members.map((m) => `m:${m.id}:${m.passwordHash ?? ""}`),
  ].sort();
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 32);
}
