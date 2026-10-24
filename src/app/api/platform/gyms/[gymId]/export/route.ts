export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/local-auth";
import { academyExportResponse } from "@/lib/academy-export-response";

function platformAdmins() {
  return (process.env.PLATFORM_ADMIN_EMAILS || "matflow@craftedsystems.io")
    .split(",")
    .map((e) => e.trim().toLowerCase());
}

/**
 * Support-assisted export (platform admins only), for an owner who cannot
 * reach the self-serve export — e.g. after cancellation. Support verifies the
 * requester owns the academy BEFORE running it (procedure in
 * docs/ACADEMY-EXPORT.md) and delivers the file privately, never as a shared
 * public link. Does not change any owner's access.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ gymId: string }> }) {
  const session = await getSession();
  if (!session || !platformAdmins().includes(session.email.trim().toLowerCase())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { gymId } = await params;
  return academyExportResponse(gymId, { label: "MatFlow support" });
}
