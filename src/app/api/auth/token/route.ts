export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSession } from "@/lib/local-auth";

/**
 * Returns the raw session JWT so the native iOS/Android wrapper can stash it
 * in Capacitor Preferences (which persists across app-kill). On next launch,
 * the native bridge uses this token to hit /api/auth/restore and reinstate
 * the httpOnly cookie — fixes the WKWebView cookie wipe on swipe-up close.
 *
 * Only returns the token when the caller already holds a valid session
 * cookie. Not usable as a credential-granting endpoint.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ token: null }, { status: 401 });
  }

  const c = await cookies();
  const token = c.get("matflow-session")?.value || null;
  return NextResponse.json({ token });
}
