export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSession, createSession } from "@/lib/local-auth";
import { prisma } from "@/lib/prisma";

const PLATFORM_ADMINS = (process.env.PLATFORM_ADMIN_EMAILS || "matflow@craftedsystems.io,franklujan@gmail.com")
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

  // Stash original admin so Exit can restore the session
  const c = await cookies();
  c.set("view_student_origin", session.email, { httpOnly: true, path: "/", sameSite: "lax" });
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
  });

  return NextResponse.json({ success: true });
}
