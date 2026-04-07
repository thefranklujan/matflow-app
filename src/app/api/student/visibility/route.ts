export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { effectiveStudentId } from "@/lib/community-auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const studentId = await effectiveStudentId();
  if (!studentId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { shareSchedule, showFriendsSchedule } = await req.json();

  await prisma.student.update({
    where: { id: studentId },
    data: {
      ...(typeof shareSchedule === "boolean" ? { shareSchedule } : {}),
      ...(typeof showFriendsSchedule === "boolean" ? { showFriendsSchedule } : {}),
    },
  });

  return NextResponse.json({ success: true });
}
