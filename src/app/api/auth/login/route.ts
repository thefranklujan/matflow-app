export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { authenticateUser, createSession, AmbiguousIdentityError } from "@/lib/local-auth";
import { isPlatformAdminSession } from "@/lib/platform-admin";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    const user = await authenticateUser(email, password);
    if (!user) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    await createSession(user);

    // Server-side flag on the Member row, never the email (audit C1).
    const isPlatformAdmin = await isPlatformAdminSession(user);

    // Students always land in /student, whether they have a gym or not.
    // Gym context (gymId/memberId) is already populated in the session by
    // authenticateStudent for student accounts linked to a Member record.
    return NextResponse.json({
      success: true,
      user: { email: user.email, name: user.name, role: user.role },
      isPlatformAdmin,
      isStudent: user.userType === "student",
    });
  } catch (error) {
    if (error instanceof AmbiguousIdentityError) {
      return NextResponse.json({ error: error.message, code: "AMBIGUOUS_IDENTITY" }, { status: 409 });
    }
    console.error("Login error:", error);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
