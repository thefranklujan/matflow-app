export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { effectiveStudentId, isGroupMod } from "@/lib/community-auth";

export async function POST(req: NextRequest) {
  const studentId = await effectiveStudentId();
  if (!studentId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { groupId, memberStudentId, action } = await req.json();
  if (!groupId || !memberStudentId || !["promote", "demote"].includes(action)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  if (!(await isGroupMod(groupId, studentId))) {
    return NextResponse.json({ error: "Not a moderator" }, { status: 403 });
  }

  if (action === "demote") {
    // Don't allow demoting the last active mod
    const modCount = await prisma.gymGroupMember.count({
      where: { groupId, role: "mod", status: "active" },
    });
    if (modCount <= 1) {
      return NextResponse.json({ error: "Cannot demote the last moderator" }, { status: 400 });
    }
  }

  await prisma.gymGroupMember.update({
    where: { groupId_studentId: { groupId, studentId: memberStudentId } },
    data: { role: action === "promote" ? "mod" : "member" },
  });

  return NextResponse.json({ success: true });
}
