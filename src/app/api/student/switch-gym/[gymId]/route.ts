export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSession, createSession } from "@/lib/local-auth";
import { prisma } from "@/lib/prisma";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ gymId: string }> }) {
  const session = await getSession();
  // 303: the form POSTs here; the follow-up must be a GET of the page.
  if (!session?.studentId) return NextResponse.redirect(new URL("/sign-in", _req.url), 303);

  const { gymId } = await params;

  // Only a CURRENT membership (active + approved) can become the context;
  // a revoked or pending membership never re-enters the session.
  const member = await prisma.member.findFirst({
    where: { studentId: session.studentId, gymId, active: true, approved: true },
    include: { gym: { select: { name: true } } },
  });
  if (!member) return NextResponse.redirect(new URL("/student/academy", _req.url), 303);

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

  const dest = new URL("/student/academy", _req.url);
  dest.searchParams.set("gym", member.gymId);
  return NextResponse.redirect(dest, 303);
}
