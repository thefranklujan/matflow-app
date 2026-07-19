export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSession } from "@/lib/local-auth";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { deriveEntitlement } from "@/lib/entitlements";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ authenticated: false });
  }

  // Apply view-as-student downgrade for client (so sidebar hides admin items)
  const c = await cookies();
  const viewAsStudent = c.get("view_as_student")?.value === "1";
  if (viewAsStudent && session.role === "admin") {
    session.role = "member";
  }

  let gym = null;
  let billing: { approved: boolean; subscriptionStatus: string; trialEndsAt: string | null; stripePriceId: string | null } | null = null;
  let entitlement: { state: string; plan: string | null; hasOwnerAccess: boolean; memberLimit: number | null; unknownPrice: boolean } | null = null;
  if (session.gymId) {
    const g = await prisma.gym.findUnique({
      where: { id: session.gymId },
      select: { name: true, logo: true, approved: true, subscriptionStatus: true, trialEndsAt: true, stripePriceId: true },
    });
    if (g) gym = { name: g.name, logo: g.logo };
    if (g) billing = {
      approved: g.approved,
      subscriptionStatus: g.subscriptionStatus,
      trialEndsAt: g.trialEndsAt?.toISOString() || null,
      stripePriceId: g.stripePriceId || null,
    };
    if (g) {
      // Server-derived entitlement for UI PRESENTATION (hide/label features).
      // Authorization itself is enforced server-side in the routes.
      const e = deriveEntitlement({
        subscriptionStatus: g.subscriptionStatus,
        trialEndsAt: g.trialEndsAt,
        stripePriceId: g.stripePriceId,
        approved: g.approved,
      });
      entitlement = {
        state: e.state,
        plan: e.plan,
        hasOwnerAccess: e.hasOwnerAccess,
        memberLimit: e.memberLimit,
        unknownPrice: e.unknownPrice,
      };
    }
  }

  const platformAdmins = (process.env.PLATFORM_ADMIN_EMAILS || "matflow@craftedsystems.io")
    .split(",")
    .map(e => e.trim().toLowerCase());
  const isPlatformAdmin = platformAdmins.includes(session.email.trim().toLowerCase());

  return NextResponse.json({ authenticated: true, user: session, gym, isPlatformAdmin, billing, entitlement });
}
