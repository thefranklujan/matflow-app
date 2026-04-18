export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "matflow-dev-secret-change-in-production"
);
const COOKIE_NAME = "matflow-session";

/**
 * Accepts a session JWT (previously issued by /api/auth/login) and re-sets it
 * as the httpOnly session cookie. Called by the native bridge on app launch
 * when the WKWebView cookie jar has been wiped but Capacitor Preferences
 * still holds a valid token. If the token has expired or is tampered, the
 * request fails and the bridge clears its stored copy.
 */
export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();
    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    // Throws if expired, tampered, or signed with a different secret
    await jwtVerify(token, JWT_SECRET);

    const res = NextResponse.json({ success: true });
    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days (same as createSession)
      path: "/",
    });
    return res;
  } catch {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }
}
