export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendJoinRequestApprovedToStudent } from "@/lib/email";
import { checkMemberLimit } from "@/lib/billing";
import { logActivity } from "@/lib/activity-log";
import { sendPush } from "@/lib/push";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { gymId } = await requireAdmin();
    const { id } = await params;

    const request = await prisma.joinRequest.findFirst({
      where: { id, gymId },
      include: { student: true, gym: { select: { name: true } } },
    });
    if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (request.status !== "pending") return NextResponse.json({ error: "Already decided" }, { status: 400 });

    const { allowed, current, limit } = await checkMemberLimit(gymId);
    if (!allowed) {
      return NextResponse.json(
        { error: `Member limit reached (${current}/${limit}). Upgrade to Pro for unlimited members.` },
        { status: 403 }
      );
    }

    // Create a Member record linked to the Student
    await prisma.$transaction(async (tx) => {
      await tx.member.create({
        data: {
          gymId,
          clerkUserId: `student-${request.student.id}-${gymId}`,
          email: request.student.email,
          firstName: request.student.firstName,
          lastName: request.student.lastName,
          phone: request.student.phone,
          studentId: request.student.id,
          beltRank: "white",
          stripes: 0,
          approved: true,
          active: true,
        },
      });

      await tx.joinRequest.update({
        where: { id },
        data: { status: "approved", decidedAt: new Date() },
      });
    });

    sendJoinRequestApprovedToStudent(
      request.student.email,
      `${request.student.firstName} ${request.student.lastName}`,
      request.gym.name
    );
    sendPush({
      externalIds: [`student-${request.student.id}`],
      title: `You're in at ${request.gym.name}!`,
      body: "Your join request was approved. Tap to open your training home.",
      url: "/student",
    });
    logActivity({ gymId, action: "join_approved", actorName: "Admin", targetId: request.student.id, targetName: `${request.student.firstName} ${request.student.lastName}` });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
