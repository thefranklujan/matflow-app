export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireOwnerAccess, entitlementErrorBody } from "@/lib/owner-access";
import { academyExportResponse } from "@/lib/academy-export-response";

/**
 * GET /api/admin/export — the signed-in owner's academy data (JSON download).
 *
 * Uses the same owner-access gate as other owner features. A locked-out owner
 * (expired trial / canceled) gets 402 with code SUBSCRIPTION_REQUIRED and is
 * served by the support-assisted path (/api/platform/gyms/[gymId]/export)
 * until Frank decides whether locked-out owners may self-export.
 */
export async function GET() {
  let ctx: { gymId: string; memberId: string | null; userId: string };
  try {
    ctx = await requireOwnerAccess();
  } catch (err) {
    const entitlement = entitlementErrorBody(err);
    if (entitlement) {
      return NextResponse.json(
        { ...entitlement, supportExport: "Contact MatFlow support for an assisted export of your academy's records." },
        { status: 402 },
      );
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return academyExportResponse(ctx.gymId, { id: ctx.memberId ?? undefined, label: "Owner" });
}
