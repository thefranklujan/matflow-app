export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSession, createSession } from "@/lib/local-auth";
import { prisma } from "@/lib/prisma";

const PLATFORM_ADMINS = (process.env.PLATFORM_ADMIN_EMAILS || "matflow@craftedsystems.io")
  .split(",").map(e => e.trim().toLowerCase());

export async function POST(_req: NextRequest, { params }: { params: Promise<{ studentId: string }> }) {
  const session = await getSession();
  if (!session || !PLATFORM_ADMINS.includes(session.email.trim().toLowerCase())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { studentId } = await params;
  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  await createSession({
    userId: `student-${student.id}`,
    email: student.email,
    name: `${student.firstName} ${student.lastName}`,
    role: "member",
    gymId: "",
    memberId: "",
    userType: "student",
    studentId: student.id,
  });

  return NextResponse.json({ success: true });
}
