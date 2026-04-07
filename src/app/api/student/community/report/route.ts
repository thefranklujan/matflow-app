export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { effectiveStudentId } from "@/lib/community-auth";

const AUTO_HIDE_THRESHOLD = 3;

export async function POST(req: NextRequest) {
  const studentId = await effectiveStudentId();
  if (!studentId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { postId, reason } = await req.json();
  if (!postId) return NextResponse.json({ error: "Missing postId" }, { status: 400 });

  const post = await prisma.groupPost.findUnique({ where: { id: postId } });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Verify reporter is an active member of the same group
  const membership = await prisma.gymGroupMember.findUnique({
    where: { groupId_studentId: { groupId: post.groupId, studentId } },
  });
  if (!membership || membership.status !== "active") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await prisma.postReport.create({
      data: { postId, reporterId: studentId, reason: reason || null },
    });
  } catch {
    // already reported
    return NextResponse.json({ success: true, alreadyReported: true });
  }

  const newCount = post.reportCount + 1;
  const shouldHide = newCount >= AUTO_HIDE_THRESHOLD;
  await prisma.groupPost.update({
    where: { id: postId },
    data: {
      reportCount: newCount,
      ...(shouldHide && !post.hidden
        ? { hidden: true, hiddenAt: new Date(), hiddenBy: "auto" }
        : {}),
    },
  });

  return NextResponse.json({ success: true, hidden: shouldHide });
}
