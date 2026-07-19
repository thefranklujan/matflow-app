import type { Prisma } from "@prisma/client";
import { deriveEntitlement } from "@/lib/entitlements";

/**
 * Transactional member-capacity service.
 *
 * Every path that creates an active member or reactivates an inactive one
 * (new join, signed-in join, join-request approval, drop-in conversion,
 * admin reactivation) must make its capacity decision INSIDE a transaction
 * that holds the gym's advisory lock:
 *
 *   await prisma.$transaction(async (tx) => {
 *     await lockMemberCapacity(tx, gymId);      // serialize per gym
 *     ...path-specific reads...
 *     await assertSeatAvailable(tx, gymId);     // re-read plan + count under the lock
 *     ...create/reactivate the member via tx...
 *   });
 *
 * pg_advisory_xact_lock serializes concurrent transactions on the same gym
 * (released automatically at commit/rollback), and the count is re-read under
 * the lock — so two concurrent joins at member 99/100 can never produce 101.
 * Emails/notifications must be emitted only AFTER the transaction commits.
 */

export type Tx = Prisma.TransactionClient;

export class MemberLimitError extends Error {
  current: number;
  limit: number;
  constructor(current: number, limit: number) {
    super(`Member limit reached (${current}/${limit}). Upgrade to Pro for unlimited members.`);
    this.name = "MemberLimitError";
    this.current = current;
    this.limit = limit;
  }
}

/** Serialize capacity decisions for one gym (transaction-scoped advisory lock). */
export async function lockMemberCapacity(tx: Tx, gymId: string): Promise<void> {
  const key = `member-capacity:${gymId}`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
}

/**
 * Throw MemberLimitError when the gym has no free seat. Must be called under
 * lockMemberCapacity in the SAME transaction. Plan and count are read fresh
 * here — never trust a pre-transaction check.
 */
export async function assertSeatAvailable(tx: Tx, gymId: string, seatsNeeded = 1): Promise<void> {
  const gym = await tx.gym.findUnique({
    where: { id: gymId },
    select: { subscriptionStatus: true, trialEndsAt: true, stripePriceId: true, approved: true },
  });
  if (!gym) throw new Error("Gym not found");

  const entitlement = deriveEntitlement({
    subscriptionStatus: gym.subscriptionStatus,
    trialEndsAt: gym.trialEndsAt,
    stripePriceId: gym.stripePriceId,
    // Approval gates dashboard access elsewhere; the seat cap depends on plan only.
    approved: gym.approved ?? true,
  });

  if (entitlement.memberLimit == null) return; // Pro: unlimited

  const current = await tx.member.count({ where: { gymId, active: true } });
  if (current + seatsNeeded > entitlement.memberLimit) {
    throw new MemberLimitError(current, entitlement.memberLimit);
  }
}
