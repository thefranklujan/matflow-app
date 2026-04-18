export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { SignJWT } from "jose";
import { prisma } from "@/lib/prisma";
import { sendPasswordReset } from "@/lib/email";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "matflow-dev-secret-change-in-production"
);

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
    console.log("[forgot-password] request for", emailLower);

    // Look up both sides: a Student account or a (gym-owner) Member account
    const [student, member] = await Promise.all([
      prisma.student.findUnique({
        where: { email: emailLower },
        select: { id: true, firstName: true, email: true, passwordHash: true },
      }),
      prisma.member.findFirst({
        where: { email: emailLower },
        select: { id: true, firstName: true, email: true, passwordHash: true },
      }),
    ]);

    console.log("[forgot-password] found", {
      email: emailLower,
      studentFound: !!student,
      memberFound: !!member,
      studentHasHash: !!student?.passwordHash,
      memberHasHash: !!member?.passwordHash,
    });

    // Prefer Student (direct signup path). Fall back to Member (gym owner).
    const target =
      student
        ? { kind: "student" as const, id: student.id, name: student.firstName, email: student.email, passwordHash: student.passwordHash }
        : member?.passwordHash
        ? { kind: "member" as const, id: member.id, name: member.firstName, email: member.email, passwordHash: member.passwordHash }
        : null;

    if (!target || !target.passwordHash) {
      console.log("[forgot-password] no target found, returning success anyway");
    }

    if (target && target.passwordHash) {
      console.log("[forgot-password] sending reset email to", target.email, "kind=", target.kind);
      const token = await new SignJWT({
        sub: target.id,
        kind: target.kind,
        hp: target.passwordHash.slice(0, 20), // hash prefix — invalidates when password changes
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

      sendPasswordReset(target.email, target.name, resetUrl);
    }

    // Constant-time-ish response — don't leak whether the email exists
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[forgot-password]", err);
    return NextResponse.json({ error: "Request failed" }, { status: 500 });
  }
}
