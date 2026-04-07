/**
 * Auth helpers. uses local auth for development.
 * The interface stays the same so all API routes work unchanged.
 * Swap to Clerk imports when going to production.
 */
import { getSession } from "@/lib/local-auth";
import { cookies } from "next/headers";

export interface AuthContext {
  userId: string;
  orgId: string | null;
  orgRole: string | null;
  gymId: string | null;
  memberId: string | null;
}

export async function getAuthContext(): Promise<AuthContext> {
  const session = await getSession();

  if (!session) {
    throw new Error("Unauthorized");
  }

  let orgRole = session.role === "admin" ? "org:admin" : "org:member";
  // "View as student" mode: admin temporarily downgrades to member view
  try {
    const c = await cookies();
    if (orgRole === "org:admin" && c.get("view_as_student")?.value === "1") {
      orgRole = "org:member";
    }
  } catch {
    // cookies() can throw outside request scope
  }

  return {
    userId: session.userId,
    orgId: session.gymId,
    orgRole,
    gymId: session.gymId,
    memberId: session.memberId,
  };
}

export async function requireAdmin(): Promise<AuthContext & { gymId: string }> {
  const ctx = await getAuthContext();

  if (!ctx.gymId) {
    throw new Error("No organization selected");
  }

  if (ctx.orgRole !== "org:admin") {
    throw new Error("Forbidden: admin access required");
  }

  return ctx as AuthContext & { gymId: string };
}

export async function requireMember(): Promise<AuthContext & { gymId: string; memberId: string }> {
  const ctx = await getAuthContext();

  if (!ctx.gymId) {
    throw new Error("No organization selected");
  }

  if (!ctx.memberId) {
    throw new Error("No member profile found");
  }

  return ctx as AuthContext & { gymId: string; memberId: string };
}
