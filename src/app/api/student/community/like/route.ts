export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { effectiveStudentId } from "@/lib/community-auth";

export async function POST(req: NextRequest) {
  const studentId = await effectiveStudentId();
  if (!studentId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { postId } = await req.json();
  if (!postId) return NextResponse.json({ error: "Missing postId" }, { status: 400 });

  const post = await prisma.groupPost.findUnique({ where: { id: postId } });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Verify member of the group
  const m = await prisma.gymGroupMember.findUnique({
    where: { groupId_studentId: { groupId: post.groupId, studentId } },
  });
  if (!m || m.status !== "active") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await prisma.postLike.findUnique({
    where: { postId_studentId: { postId, studentId } },
  });
  if (existing) {
    await prisma.postLike.delete({ where: { id: existing.id } });
    return NextResponse.json({ liked: false });
  }
  await prisma.postLike.create({ data: { postId, studentId } });
  return NextResponse.json({ liked: true });
}
