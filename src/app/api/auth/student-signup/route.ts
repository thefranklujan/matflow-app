export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { registerStudent, createSession } from "@/lib/local-auth";
import { sendWelcomeEmail, notifyAdminOfNewStudent } from "@/lib/email";

export async function POST(request: NextRequest) {
  try {
    const { firstName, lastName, email, password, phone } = await request.json();

    if (!firstName || !lastName || !email || !password) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    const student = await registerStudent({ firstName, lastName, email, password, phone });

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

    sendWelcomeEmail(email, `${firstName} ${lastName}`, "MatFlow");
    notifyAdminOfNewStudent({ firstName, lastName, email, phone });

    return NextResponse.json({ success: true, student }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Registration failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
