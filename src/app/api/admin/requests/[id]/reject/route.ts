export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendJoinRequestRejectedToStudent } from "@/lib/email";

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

    await prisma.joinRequest.update({
      where: { id },
      data: { status: "rejected", decidedAt: new Date() },
    });

    sendJoinRequestRejectedToStudent(
      request.student.email,
      `${request.student.firstName} ${request.student.lastName}`,
      request.gym.name
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
