export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { registerMember, createSession } from "@/lib/local-auth";
import { sendWelcomeEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";

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

    const result = await registerMember({
      email,
      phone,
      password,
      firstName,
      lastName,
      gymSlug,
    });

    await createSession({
      userId: `member-${result.member.id}`,
      email,
      name: `${firstName} ${lastName}`,
      role: "member",
      gymId: result.member.gymId,
      memberId: result.member.id,
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
