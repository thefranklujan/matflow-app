export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { registerGymOwner, createSession } from "@/lib/local-auth";

export async function POST(request: NextRequest) {
  try {
    const { firstName, lastName, email, password, gymName, gymSlug, timezone } =
      await request.json();

    if (!firstName || !lastName || !email || !password || !gymName || !gymSlug) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    const result = await registerGymOwner({
      email,
      password,
      firstName,
      lastName,
      gymName,
      gymSlug,
      timezone,
    });

    // Create session for the new owner
    await createSession({
      userId: `owner-${result.member.id}`,
      email,
      name: `${firstName} ${lastName}`,
      role: "admin",
      gymId: result.gym.id,
      memberId: result.member.id,
    });

    return NextResponse.json(
      { success: true, gym: result.gym },
      { status: 201 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Registration failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
