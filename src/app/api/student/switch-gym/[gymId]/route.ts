export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSession, createSession } from "@/lib/local-auth";
import { prisma } from "@/lib/prisma";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ gymId: string }> }) {
  const session = await getSession();
  if (!session?.studentId) return NextResponse.redirect(new URL("/sign-in", _req.url));

  const { gymId } = await params;

  // Verify the student is a member of this gym
  const member = await prisma.member.findFirst({
    where: { studentId: session.studentId, gymId },
    include: { gym: { select: { name: true } } },
  });
  if (!member) return NextResponse.redirect(new URL("/student", _req.url));

  // Create a member-context session for this gym
  await createSession({
    userId: member.clerkUserId,
    email: member.email,
    name: `${member.firstName} ${member.lastName}`,
    role: "member",
    gymId: member.gymId,
    memberId: member.id,
    userType: "member",
    studentId: session.studentId,
  });

  return NextResponse.redirect(new URL("/app", _req.url));
}
