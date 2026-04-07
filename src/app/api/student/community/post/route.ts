export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/local-auth";
import { prisma } from "@/lib/prisma";

async function effectiveStudentId() {
  const session = await getSession();
  if (!session) return null;
  if (session.studentId) return session.studentId;
  if (session.memberId) {
    const m = await prisma.member.findUnique({ where: { id: session.memberId }, select: { studentId: true } });
    return m?.studentId || null;
  }
  return null;
}

export async function POST(req: NextRequest) {
  const studentId = await effectiveStudentId();
  if (!studentId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { groupId, body } = await req.json();
  if (!groupId || !body?.trim()) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // Verify active membership (pending vouches cannot post)
  const member = await prisma.gymGroupMember.findUnique({
    where: { groupId_studentId: { groupId, studentId } },
  });
  if (!member || member.status !== "active") {
    return NextResponse.json({ error: "Not an active group member" }, { status: 403 });
  }

  const post = await prisma.groupPost.create({
    data: { groupId, studentId, body: body.trim() },
  });
  return NextResponse.json(post, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const studentId = await effectiveStudentId();
  if (!studentId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  await prisma.groupPost.deleteMany({ where: { id, studentId } });
  return NextResponse.json({ success: true });
}
