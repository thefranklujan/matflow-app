export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

/**
 * The kiosk is off until check-in codes are issued (nothing writes
 * Member.checkinCode) and the route has a rate limit. Both methods answer 404.
 * The previous implementation lives in git history (before the Phase 0 hotfix).
 */
function gone() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export const GET = gone;
export const POST = gone;
