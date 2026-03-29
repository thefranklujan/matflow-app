export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { authenticateUser, createSession, ensureDefaults } from "@/lib/local-auth";

export async function POST(request: NextRequest) {
  try {
    // Ensure default gym and users exist
    await ensureDefaults();

    const { email, password } = await request.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    const user = await authenticateUser(email, password);
    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    await createSession(user);

    return NextResponse.json({
      success: true,
      user: { email: user.email, name: user.name, role: user.role },
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
