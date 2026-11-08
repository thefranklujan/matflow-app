export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { JWT_SECRET } from "@/lib/jwt-secret";
import { MIN_PASSWORD } from "@/lib/owner-registration";
import { identitiesForEmail, identitiesFingerprint } from "@/lib/password-recovery";

/**
 * Verifies a reset token and updates the account password. The token is
 * single-use by virtue of embedding a prefix of the current passwordHash —
 * once the hash changes, the embedded prefix no longer matches.
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

    let payload: {
      sub?: string;
      kind?: "student" | "member" | "email";
      hp?: string;
      purpose?: string;
    };
    try {
      const verified = await jwtVerify(token, JWT_SECRET);
      payload = verified.payload as typeof payload;
    } catch {
      return NextResponse.json(
        { error: "Reset link is invalid or expired" },
        { status: 401 }
      );
    }

    if (payload.purpose !== "password-reset" || !payload.sub || !payload.kind || !payload.hp) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // Current links: reset every identity that uses the address.
    if (payload.kind === "email") {
      const ids = await identitiesForEmail(payload.sub);
      if (identitiesFingerprint(ids) !== payload.hp) {
        return NextResponse.json(
          { error: "This reset link has already been used" },
          { status: 401 }
        );
      }
      const newHash = await bcrypt.hash(password, 10);
      const memberIds = ids.members.filter((m) => m.passwordHash).map((m) => m.id);
      await prisma.$transaction([
        ...(ids.student
          ? [
              prisma.student.update({ where: { id: ids.student.id }, data: { passwordHash: newHash } }),
              prisma.member.updateMany({ where: { studentId: ids.student.id }, data: { passwordHash: newHash } }),
            ]
          : []),
        prisma.member.updateMany({ where: { id: { in: memberIds } }, data: { passwordHash: newHash } }),
      ]);
      return NextResponse.json({ success: true });
    }

    // Links issued before the Phase 0 hotfix (one identity each).
    if (payload.kind === "student") {
      const student = await prisma.student.findUnique({
        where: { id: payload.sub },
        select: { id: true, passwordHash: true },
      });
      if (!student || student.passwordHash.slice(0, 20) !== payload.hp) {
        return NextResponse.json(
          { error: "This reset link has already been used" },
          { status: 401 }
        );
      }
      const newHash = await bcrypt.hash(password, 10);
      await prisma.student.update({
        where: { id: student.id },
        data: { passwordHash: newHash },
      });
      // Also refresh any Member rows pointing at this student so sign-in via
      // gym-member path keeps working.
      await prisma.member.updateMany({
        where: { studentId: student.id },
        data: { passwordHash: newHash },
      });
      return NextResponse.json({ success: true });
    }

    // member (gym owner / staff)
    const member = await prisma.member.findUnique({
      where: { id: payload.sub },
      select: { id: true, passwordHash: true },
    });
    if (!member?.passwordHash || member.passwordHash.slice(0, 20) !== payload.hp) {
      return NextResponse.json(
        { error: "This reset link has already been used" },
        { status: 401 }
      );
    }
    const newHash = await bcrypt.hash(password, 10);
    await prisma.member.update({
      where: { id: member.id },
      data: { passwordHash: newHash },
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[reset-password]", err);
    return NextResponse.json({ error: "Reset failed" }, { status: 500 });
  }
}
