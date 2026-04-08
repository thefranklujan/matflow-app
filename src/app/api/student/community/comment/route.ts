export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { effectiveStudentId } from "@/lib/community-auth";

export async function POST(req: NextRequest) {
  const studentId = await effectiveStudentId();
  if (!studentId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { postId, body } = await req.json();
  if (!postId || !body?.trim()) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  if (body.length > 500) {
    return NextResponse.json({ error: "Too long" }, { status: 400 });
  }

  const post = await prisma.groupPost.findUnique({ where: { id: postId } });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const m = await prisma.gymGroupMember.findUnique({
    where: { groupId_studentId: { groupId: post.groupId, studentId } },
  });
  if (!m || m.status !== "active") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const comment = await prisma.postComment.create({
    data: { postId, studentId, body: body.trim() },
    include: { student: { select: { firstName: true, lastName: true, avatarUrl: true, beltRank: true } } },
  });

  return NextResponse.json({
    id: comment.id,
    body: comment.body,
    createdAt: comment.createdAt.toISOString(),
    authorName: `${comment.student.firstName} ${comment.student.lastName}`,
    authorAvatar: comment.student.avatarUrl,
    authorBelt: comment.student.beltRank,
    isMine: true,
  });
}

export async function DELETE(req: NextRequest) {
  const studentId = await effectiveStudentId();
  if (!studentId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  await prisma.postComment.deleteMany({ where: { id, studentId } });
  return NextResponse.json({ success: true });
}
