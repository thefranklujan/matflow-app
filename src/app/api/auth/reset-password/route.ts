export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { JWT_SECRET } from "@/lib/jwt-secret";
import { MIN_PASSWORD } from "@/lib/owner-registration";
import { identitiesForEmail, identitiesFingerprint } from "@/lib/password-recovery";
import { lockIdentityEmail } from "@/lib/identity-lock";

/**
 * Verifies an address-wide reset token and sets the new password on every
 * identity using the address. Single use: the token carries a fingerprint of
 * all current hashes, re-checked and consumed atomically under the
 * per-address identity lock (see src/lib/password-recovery.ts).
 */
export async function POST(request: NextRequest) {
  try {
    const { token, password } = await request.json();

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }
    if (!password || typeof password !== "string" || password.length < MIN_PASSWORD) {
      return NextResponse.json(
        { error: `Password must be at least ${MIN_PASSWORD} characters` },
        { status: 400 }
      );
    }

    let payload: { sub?: string; kind?: string; hp?: string; purpose?: string };
    try {
      const verified = await jwtVerify(token, JWT_SECRET);
      payload = verified.payload as typeof payload;
    } catch {
      return NextResponse.json(
        { error: "Reset link is invalid or expired" },
        { status: 401 }
      );
    }

    // Only address-wide links (src/lib/password-recovery.ts). Single-identity
    // links issued before the Phase 0 hotfix are refused; the user requests a
    // new one (they expired within an hour anyway).
    if (payload.purpose !== "password-reset" || payload.kind !== "email" || !payload.sub || !payload.hp) {
      return NextResponse.json({ error: "Reset link is invalid or expired" }, { status: 401 });
    }
    const emailLower = payload.sub;
    const expected = payload.hp;

    // Hash outside the transaction (slow); verify and write inside it, under
    // the per-address lock, so the link is consumed exactly once.
    const newHash = await bcrypt.hash(password, 10);
    const consumed = await prisma.$transaction(async (tx) => {
      await lockIdentityEmail(tx, emailLower);
      const ids = await identitiesForEmail(emailLower, tx);
      if (identitiesFingerprint(ids) !== expected) return false;
      if (ids.student) {
        await tx.student.update({ where: { id: ids.student.id }, data: { passwordHash: newHash } });
        // Member rows linked to the student mirror its password (join path).
        await tx.member.updateMany({ where: { studentId: ids.student.id }, data: { passwordHash: newHash } });
      }
      const memberIds = ids.members.filter((m) => m.passwordHash).map((m) => m.id);
      if (memberIds.length) {
        await tx.member.updateMany({ where: { id: { in: memberIds } }, data: { passwordHash: newHash } });
      }
      return true;
    });

    if (!consumed) {
      return NextResponse.json({ error: "This reset link has already been used" }, { status: 401 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[reset-password]", err);
    return NextResponse.json({ error: "Reset failed" }, { status: 500 });
  }
}
