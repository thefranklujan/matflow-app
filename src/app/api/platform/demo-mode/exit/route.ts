export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { LEGACY_ORIGIN_COOKIES, restoreImpersonator } from "@/lib/platform-admin";

/**
 * End demo mode. Requires a valid session carrying `impersonatorId` (written
 * into the signed JWT when impersonation started); restores that platform
 * admin by member id and re-derives the role. Cookies are display-only and
 * never decide who is restored (audit C2).
 */
export async function POST() {
  const result = await restoreImpersonator();

  const c = await cookies();
  for (const name of [...LEGACY_ORIGIN_COOKIES, "demo_mode"]) c.delete(name);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ success: true });
}
