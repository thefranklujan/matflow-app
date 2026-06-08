export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { registerMember, createSession } from "@/lib/local-auth";
import { sendWelcomeEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";
import { checkMemberLimit } from "@/lib/billing";

export async function POST(request: NextRequest) {
  try {
    const { firstName, lastName, email, phone, password, gymSlug } =
      await request.json();

    if (!firstName || !lastName || !email || !password || !gymSlug) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    // Enforce the gym's plan member cap on the self-serve join link, same as the
    // owner-approval path. Without this the share link bypassed billing caps.
    const gymForLimit = await prisma.gym.findUnique({
      where: { slug: gymSlug },
      select: { id: true },
    });
    if (gymForLimit) {
      const limit = await checkMemberLimit(gymForLimit.id);
      if (!limit.allowed) {
        return NextResponse.json(
          { error: "This gym has reached its member limit. Please contact the gym." },
          { status: 403 }
        );
      }
    }

    const result = await registerMember({
      email,
      phone,
      password,
      firstName,
      lastName,
      gymSlug,
    });

    // Student-flavored session. They live in /student, with gym context attached.
    await createSession({
      userId: `student-${result.studentId}`,
      email: email.trim().toLowerCase(),
      name: `${firstName} ${lastName}`,
      role: "member",
      gymId: result.member.gymId,
      memberId: result.member.id,
      userType: "student",
      studentId: result.studentId,
    });

    const gym = await prisma.gym.findUnique({ where: { slug: gymSlug }, select: { name: true } });
    sendWelcomeEmail(email, `${firstName} ${lastName}`, gym?.name || "your gym");
    logActivity({ gymId: result.member.gymId, action: "member_added", targetId: result.member.id, targetName: `${firstName} ${lastName}` });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Registration failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
