import { prisma } from "@/lib/prisma";

const BASIC_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_BASIC_PRICE_ID || "price_basic";
const BASIC_MEMBER_LIMIT = 100;

export async function checkMemberLimit(gymId: string): Promise<{ allowed: boolean; current: number; limit: number | null }> {
  const gym = await prisma.gym.findUnique({
    where: { id: gymId },
    select: { stripePriceId: true, subscriptionStatus: true },
  });

  if (gym?.stripePriceId !== BASIC_PRICE_ID || gym.subscriptionStatus !== "active") {
    return { allowed: true, current: 0, limit: null };
  }

  const count = await prisma.member.count({ where: { gymId, active: true } });
  return {
    allowed: count < BASIC_MEMBER_LIMIT,
    current: count,
    limit: BASIC_MEMBER_LIMIT,
  };
}
