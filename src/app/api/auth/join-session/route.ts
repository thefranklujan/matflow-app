export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSession, joinGymAsStudent, createSession } from "@/lib/local-auth";
import { checkMemberLimit } from "@/lib/billing";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";

/**
 * One-tap join for a visitor who is ALREADY signed in (member link). Reuses
 * their existing Student identity instead of forcing a new sign-up.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !session.studentId) {
      return NextResponse.json(
        { error: "Please sign in to join this gym." },
        { status: 401 }
      );
    }

    const { gymSlug } = await request.json();
    if (!gymSlug) {
      return NextResponse.json({ error: "Missing gym" }, { status: 400 });
    }

    const gym = await prisma.gym.findUnique({
      where: { slug: gymSlug },
      select: { id: true },
    });
    if (gym) {
      const limit = await checkMemberLimit(gym.id);
      if (!limit.allowed) {
        return NextResponse.json(
          { error: "This gym has reached its member limit. Please contact the gym." },
          { status: 403 }
        );
      }
    }

    const result = await joinGymAsStudent(session.studentId, gymSlug);

    // Refresh the session so gym context is attached for member features.
    await createSession({
      ...session,
      gymId: result.member.gymId,
      memberId: result.member.id,
      userType: "student",
    });

    logActivity({
      gymId: result.member.gymId,
      action: "member_added",
      targetId: result.member.id,
      targetName: session.name,
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not join gym";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
