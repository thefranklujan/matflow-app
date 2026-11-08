export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { SignJWT } from "jose";
import { sendPasswordReset } from "@/lib/email";
import { JWT_SECRET } from "@/lib/jwt-secret";
import { identitiesForEmail, hasPasswordIdentity, identitiesFingerprint, recoveryName } from "@/lib/password-recovery";

/**
 * Email-based password reset. Issues a 1-hour signed token that encodes the
 * account's current passwordHash prefix — that way, as soon as the password
 * is actually changed, any existing reset token becomes invalid (effectively
 * single-use without needing a DB table).
 *
 * Always returns success to avoid leaking whether an email is registered.
 */
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

    const emailLower = email.trim().toLowerCase();

    // Every identity using the address (Student and Member rows in any gym).
    // The link resets all of them, so recovery and login agree (see
    // src/lib/password-recovery.ts). No PII is logged.
    const ids = await identitiesForEmail(emailLower);

    if (hasPasswordIdentity(ids)) {
      const token = await new SignJWT({
        sub: emailLower,
        kind: "email",
        hp: identitiesFingerprint(ids), // invalidates when any password for the address changes
        purpose: "password-reset",
      })
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime("1h")
        .sign(JWT_SECRET);

      const base =
        process.env.NEXT_PUBLIC_APP_URL ||
        process.env.APP_URL ||
        "https://app.mymatflow.com";
      const resetUrl = `${base}/reset-password?token=${encodeURIComponent(token)}`;

      // MUST await — without it the lambda returns and Vercel freezes the
      // function before the Resend HTTP request finishes, so the email never
      // actually leaves. send() already swallows its own errors so this won't
      // throw and reveal whether the email existed.
      await sendPasswordReset(emailLower, recoveryName(ids), resetUrl);
    }

    // Constant-time-ish response — don't leak whether the email exists
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[forgot-password]", err);
    return NextResponse.json({ error: "Request failed" }, { status: 500 });
  }
}
