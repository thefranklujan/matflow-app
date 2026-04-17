export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/local-auth";
import { prisma } from "@/lib/prisma";
import { sendJoinRequestSubmittedToAdmin } from "@/lib/email";
import { logActivity } from "@/lib/activity-log";
import { sendPush } from "@/lib/push";

export async function GET() {
  const session = await getSession();
  if (!session?.studentId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const requests = await prisma.joinRequest.findMany({
    where: { studentId: session.studentId },
    include: { gym: { select: { name: true, slug: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ requests });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.studentId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { gymId, message } = await req.json();
  if (!gymId) return NextResponse.json({ error: "Gym required" }, { status: 400 });

  // Prevent duplicates
  const existing = await prisma.joinRequest.findUnique({
    where: { studentId_gymId: { studentId: session.studentId, gymId } },
  });
  if (existing) return NextResponse.json({ error: "You already have a request for this gym" }, { status: 400 });

  // Prevent if already a member
  const existingMember = await prisma.member.findFirst({
    where: { studentId: session.studentId, gymId },
  });
  if (existingMember) return NextResponse.json({ error: "You are already a member" }, { status: 400 });

  const request = await prisma.joinRequest.create({
    data: { studentId: session.studentId, gymId, message: message || null },
    include: { gym: true, student: true },
  });

  // Email gym owner (first member of the gym)
  const owner = await prisma.member.findFirst({
    where: { gymId },
    orderBy: { createdAt: "asc" },
  });
  if (owner) {
    sendJoinRequestSubmittedToAdmin(
      owner.email,
      `${request.student.firstName} ${request.student.lastName}`,
      request.gym.name
    );
    // Push the gym owner on whatever device they have tagged
    sendPush({
      externalIds: [owner.clerkUserId, owner.studentId ? `student-${owner.studentId}` : ""].filter(Boolean),
      title: "New join request",
      body: `${request.student.firstName} ${request.student.lastName} wants to join ${request.gym.name}`,
      url: "/app/requests",
    });
  }

  logActivity({ gymId, action: "join_request", actorId: session.studentId, actorName: `${request.student.firstName} ${request.student.lastName}`, targetName: request.gym.name });

  return NextResponse.json({ success: true, request }, { status: 201 });
}
