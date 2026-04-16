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

  // Keep student session but refresh gym context. Students stay in /student.
  await createSession({
    userId: session.userId,
    email: member.email,
    name: `${member.firstName} ${member.lastName}`,
    role: "member",
    gymId: member.gymId,
    memberId: member.id,
    userType: "student",
    studentId: session.studentId,
  });

  return NextResponse.redirect(new URL("/student", _req.url));
}
