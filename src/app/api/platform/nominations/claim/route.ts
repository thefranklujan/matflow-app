export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/local-auth";
import { claimNominationsForGym, ClaimError } from "@/lib/nomination-claim";

function platformAdmins() {
  return (process.env.PLATFORM_ADMIN_EMAILS || "matflow@craftedsystems.io,franklujan@gmail.com")
    .split(",")
    .map((e) => e.trim().toLowerCase());
}

/**
 * Founder-only: turn explicitly selected nominations into pending join
 * requests for one academy. Community groups and their content are never
 * deleted or moved here (see src/lib/nomination-claim.ts). The old
 * name-only body ({ groupName }) is refused: a matching name claimed every
 * same-name nomination anywhere in the country.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !platformAdmins().includes(session.email.trim().toLowerCase())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const targetGymId: string = typeof body.targetGymId === "string" ? body.targetGymId.trim() : "";
  const nominationIds: string[] = Array.isArray(body.nominationIds)
    ? body.nominationIds.filter((id: unknown): id is string => typeof id === "string" && id.length > 0)
    : [];

  if (!targetGymId || nominationIds.length === 0 || nominationIds.length > 500) {
    return NextResponse.json(
      { error: "targetGymId and 1–500 nominationIds are required", code: "INVALID_BODY" },
      { status: 400 },
    );
  }

  try {
    const result = await claimNominationsForGym({
      targetGymId,
      nominationIds,
      allowLocationMismatch: body.allowLocationMismatch === true,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    if (err instanceof ClaimError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    console.error("[nominations/claim] failed:", err instanceof Error ? err.message : "unknown");
    return NextResponse.json(
      { error: "Claim failed. Nothing was changed; try again.", code: "CLAIM_FAILED" },
      { status: 500 },
    );
  }
}
