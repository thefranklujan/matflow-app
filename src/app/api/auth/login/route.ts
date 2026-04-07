export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { authenticateUser, createSession } from "@/lib/local-auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    const user = await authenticateUser(email, password);
    if (!user) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    await createSession(user);

    // If student has approved memberships, auto-switch into the most recent gym
    let autoSwitchedToGym = false;
    if (user.userType === "student" && user.studentId) {
      const member = await prisma.member.findFirst({
        where: { studentId: user.studentId, approved: true, active: true },
        orderBy: { createdAt: "desc" },
      });
      if (member) {
        await createSession({
          userId: member.clerkUserId,
          email: member.email,
          name: `${member.firstName} ${member.lastName}`,
          role: "member",
          gymId: member.gymId,
          memberId: member.id,
          userType: "member",
          studentId: user.studentId,
        });
        autoSwitchedToGym = true;
      }
    }

    const platformAdmins = (process.env.PLATFORM_ADMIN_EMAILS || "")
      .split(",")
      .map(e => e.trim().toLowerCase());
    const isPlatformAdmin = platformAdmins.includes(user.email.trim().toLowerCase());

    return NextResponse.json({
      success: true,
      user: { email: user.email, name: user.name, role: user.role },
      isPlatformAdmin,
      isStudent: user.userType === "student" && !autoSwitchedToGym,
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
