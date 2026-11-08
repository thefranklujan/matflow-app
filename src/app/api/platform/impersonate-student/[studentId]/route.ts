export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSession } from "@/lib/local-auth";
import { getPlatformAdminSession } from "@/lib/platform-admin";
import { prisma } from "@/lib/prisma";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ studentId: string }> }) {
  const session = await getPlatformAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { studentId } = await params;
  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  // Display-only cookies for the banner. Who to restore on exit travels
  // inside the signed session (impersonatorId), never in a cookie.
  const c = await cookies();
  c.set("view_student_name", `${student.firstName} ${student.lastName}`, { httpOnly: false, path: "/", sameSite: "lax" });
  c.set("viewing_student", "1", { httpOnly: false, path: "/", sameSite: "lax" });

  await createSession({
    userId: `student-${student.id}`,
    email: student.email,
    name: `${student.firstName} ${student.lastName}`,
    role: "member",
    gymId: "",
    memberId: "",
    userType: "student",
    studentId: student.id,
    impersonatorId: session.memberId,
  });

  return NextResponse.json({ success: true });
}
