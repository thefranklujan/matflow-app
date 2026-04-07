export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { authenticateUser, createSession } from "@/lib/local-auth";

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

    const platformAdmins = (process.env.PLATFORM_ADMIN_EMAILS || "")
      .split(",")
      .map(e => e.trim().toLowerCase());
    const isPlatformAdmin = platformAdmins.includes(user.email.trim().toLowerCase());

    return NextResponse.json({
      success: true,
      user: { email: user.email, name: user.name, role: user.role },
      isPlatformAdmin,
      isStudent: user.userType === "student",
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
