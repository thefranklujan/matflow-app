import { prisma } from "@/lib/prisma";
import { deriveEntitlement } from "@/lib/entitlements";

/**
 * Server-side active-member limit check. Derives the cap from the gym's
 * entitlement (Basic/trial = 100, Pro = unlimited) rather than a bare price
 * comparison, so the limit is enforced during the trial and for unknown-price
 * subscriptions too. Callers must run this on EVERY member-creation path.
 */
export async function checkMemberLimit(
  gymId: string,
): Promise<{ allowed: boolean; current: number; limit: number | null }> {
  const gym = await prisma.gym.findUnique({
    where: { id: gymId },
    select: { subscriptionStatus: true, trialEndsAt: true, stripePriceId: true, approved: true },
  });

  const entitlement = deriveEntitlement({
    subscriptionStatus: gym?.subscriptionStatus ?? null,
    trialEndsAt: gym?.trialEndsAt ?? null,
    stripePriceId: gym?.stripePriceId ?? null,
    // Approval gates access elsewhere; for the seat cap we only care about plan.
    approved: gym?.approved ?? true,
  });

  if (entitlement.memberLimit == null) {
    return { allowed: true, current: 0, limit: null };
  }

  const count = await prisma.member.count({ where: { gymId, active: true } });
  return {
    allowed: count < entitlement.memberLimit,
    current: count,
    limit: entitlement.memberLimit,
  };
}
