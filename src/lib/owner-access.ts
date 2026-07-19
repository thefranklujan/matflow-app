/**
 * Server-side owner-access guards, layered on top of requireAdmin.
 *
 * requireAdmin (src/lib/auth.ts) is intentionally left unchanged — it is called
 * in ~70 places and only proves "this is the gym's admin". These guards add the
 * subscription/plan dimension on top, for the routes that should be gated.
 *
 * IMPORTANT: never apply requireOwnerAccess to billing, settings, session, or
 * logout routes — those must stay reachable during a lockout so the owner can
 * recover (pay, manage the subscription, or sign out).
 */
import { requireAdmin, type AuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deriveEntitlement, planSatisfies, type Entitlement, type PlanKey } from "@/lib/entitlements";

export class EntitlementError extends Error {
  code: "SUBSCRIPTION_REQUIRED" | "PRO_REQUIRED";
  entitlement: Entitlement;
  constructor(code: "SUBSCRIPTION_REQUIRED" | "PRO_REQUIRED", entitlement: Entitlement) {
    super(code === "PRO_REQUIRED" ? "Pro plan required" : "Active subscription required");
    this.name = "EntitlementError";
    this.code = code;
    this.entitlement = entitlement;
  }
}

/** Load the current entitlement for a gym (server-authoritative). */
export async function getGymEntitlement(gymId: string): Promise<Entitlement> {
  const gym = await prisma.gym.findUnique({
    where: { id: gymId },
    select: { subscriptionStatus: true, trialEndsAt: true, stripePriceId: true, approved: true },
  });
  return deriveEntitlement({
    subscriptionStatus: gym?.subscriptionStatus ?? null,
    trialEndsAt: gym?.trialEndsAt ?? null,
    stripePriceId: gym?.stripePriceId ?? null,
    approved: gym?.approved ?? false,
  });
}

/**
 * Require an admin whose gym currently has owner access (not locked out by
 * expired trial, cancellation, past-due payment, or pending approval).
 * Throws EntitlementError("SUBSCRIPTION_REQUIRED") on lockout.
 */
export async function requireOwnerAccess(): Promise<AuthContext & { gymId: string; entitlement: Entitlement }> {
  const ctx = await requireAdmin();
  const entitlement = await getGymEntitlement(ctx.gymId);
  if (!entitlement.hasOwnerAccess) {
    throw new EntitlementError("SUBSCRIPTION_REQUIRED", entitlement);
  }
  return { ...ctx, entitlement };
}

/** Require an admin whose gym satisfies a minimum plan (e.g. Pro-only features). */
export async function requirePlan(required: PlanKey): Promise<AuthContext & { gymId: string; entitlement: Entitlement }> {
  const ctx = await requireAdmin();
  const entitlement = await getGymEntitlement(ctx.gymId);
  if (!planSatisfies(entitlement, required)) {
    throw new EntitlementError(required === "pro" ? "PRO_REQUIRED" : "SUBSCRIPTION_REQUIRED", entitlement);
  }
  return { ...ctx, entitlement };
}

/** Map an EntitlementError to an HTTP status. 402 Payment Required is the honest code. */
export function entitlementStatus(err: unknown): number | null {
  if (err instanceof EntitlementError) return 402;
  return null;
}
