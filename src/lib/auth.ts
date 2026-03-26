import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export interface AuthContext {
  userId: string;
  orgId: string | null;
  orgRole: string | null;
  gymId: string | null;
  memberId: string | null;
}

/**
 * Get the full auth context for the current request.
 * Returns Clerk user info + resolved gymId and memberId from the database.
 */
export async function getAuthContext(): Promise<AuthContext> {
  const { userId, orgId, orgRole } = await auth();

  if (!userId) {
    throw new Error("Unauthorized");
  }

  let gymId: string | null = null;
  let memberId: string | null = null;

  if (orgId) {
    const gym = await prisma.gym.findUnique({
      where: { clerkOrgId: orgId },
      select: { id: true },
    });
    gymId = gym?.id ?? null;

    if (gymId) {
      const member = await prisma.member.findFirst({
        where: { clerkUserId: userId, gymId },
        select: { id: true },
      });
      memberId = member?.id ?? null;
    }
  }

  return { userId, orgId, orgRole, gymId, memberId };
}

/**
 * Require the user to be an admin of the current org.
 */
export async function requireAdmin(): Promise<AuthContext & { gymId: string }> {
  const ctx = await getAuthContext();

  if (!ctx.orgId || !ctx.gymId) {
    throw new Error("No organization selected");
  }

  if (ctx.orgRole !== "org:admin") {
    throw new Error("Forbidden: admin access required");
  }

  return ctx as AuthContext & { gymId: string };
}

/**
 * Require the user to be a member (or admin) of the current org.
 */
export async function requireMember(): Promise<AuthContext & { gymId: string; memberId: string }> {
  const ctx = await getAuthContext();

  if (!ctx.orgId || !ctx.gymId) {
    throw new Error("No organization selected");
  }

  if (!ctx.memberId && ctx.orgRole !== "org:admin") {
    throw new Error("No member profile found");
  }

  // Admins might not have a member record — use a sentinel
  const memberId = ctx.memberId ?? "admin";

  return { ...ctx, gymId: ctx.gymId, memberId } as AuthContext & { gymId: string; memberId: string };
}
