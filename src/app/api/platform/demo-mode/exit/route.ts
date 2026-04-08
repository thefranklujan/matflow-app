export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSession } from "@/lib/local-auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const c = await cookies();
  const originEmail = c.get("demo_mode_origin")?.value;
  c.delete("demo_mode");
  c.delete("demo_mode_origin");

  if (!originEmail) {
    return NextResponse.json({ error: "No demo origin recorded" }, { status: 400 });
  }

  // Restore the original platform admin session by finding their Member row
  const member = await prisma.member.findFirst({
    where: { email: { equals: originEmail, mode: "insensitive" } },
    orderBy: { createdAt: "asc" },
  });

  if (!member) {
    return NextResponse.json({ error: "Original admin not found" }, { status: 404 });
  }

  await createSession({
    userId: member.clerkUserId,
    email: member.email,
    name: `${member.firstName} ${member.lastName}`,
    role: "admin",
    gymId: member.gymId,
    memberId: member.id,
  });

  return NextResponse.json({ success: true });
}
