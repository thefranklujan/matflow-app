export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSession } from "@/lib/local-auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const c = await cookies();
  const originEmail = c.get("view_student_origin")?.value;
  c.delete("view_student_origin");
  c.delete("view_student_name");
  c.delete("viewing_student");

  if (!originEmail) {
    return NextResponse.json({ error: "No origin recorded" }, { status: 400 });
  }

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
