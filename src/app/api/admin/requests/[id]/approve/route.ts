export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendJoinRequestApprovedToStudent } from "@/lib/email";
import { checkMemberLimit } from "@/lib/billing";
import { logActivity } from "@/lib/activity-log";
import { notify } from "@/lib/push";
import { requireOwnerAccess, entitlementErrorBody } from "@/lib/owner-access";
import { lockMemberCapacity, assertSeatAvailable, MemberLimitError } from "@/lib/member-capacity";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Roster mutations require a usable (not locked-out) academy account.
    const { gymId } = await requireOwnerAccess();
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

    // Create a Member record linked to the Student. Capacity is re-checked
    // INSIDE the transaction under the gym's advisory lock — the fast-path
    // checkMemberLimit above is a courtesy; this is the authoritative gate.
    await prisma.$transaction(async (tx) => {
      await lockMemberCapacity(tx, gymId);
      await assertSeatAvailable(tx, gymId);
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
    notify({
      externalIds: [`student-${request.student.id}`],
      kind: "join_approved",
      title: `You're in at ${request.gym.name}!`,
      body: "Your join request was approved. Tap to open your training home.",
      url: "/student",
      gymId,
    });
    logActivity({ gymId, action: "join_approved", actorName: "Admin", targetId: request.student.id, targetName: `${request.student.firstName} ${request.student.lastName}` });

    return NextResponse.json({ success: true });
  } catch (error) {
    const entitlement = entitlementErrorBody(error);
    if (entitlement) return NextResponse.json(entitlement, { status: 402 });
    if (error instanceof MemberLimitError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "Failed";
    if (message.startsWith("Unauthorized") || message.startsWith("Forbidden")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
