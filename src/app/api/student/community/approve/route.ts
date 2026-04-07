export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { effectiveStudentId, isGroupMod } from "@/lib/community-auth";

export async function POST(req: NextRequest) {
  const studentId = await effectiveStudentId();
  if (!studentId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { groupId, memberStudentId, action } = await req.json();
  if (!groupId || !memberStudentId || !["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  if (!(await isGroupMod(groupId, studentId))) {
    return NextResponse.json({ error: "Not a moderator" }, { status: 403 });
  }

  if (action === "approve") {
    await prisma.gymGroupMember.update({
      where: { groupId_studentId: { groupId, studentId: memberStudentId } },
      data: { status: "active" },
    });
    const count = await prisma.gymGroupMember.count({
      where: { groupId, status: "active" },
    });
    await prisma.gymGroup.update({ where: { id: groupId }, data: { memberCount: count } });
  } else {
    await prisma.gymGroupMember.delete({
      where: { groupId_studentId: { groupId, studentId: memberStudentId } },
    });
  }

  return NextResponse.json({ success: true });
}
