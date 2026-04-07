export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { effectiveStudentId, isGroupMod } from "@/lib/community-auth";

// Mod actions: hide, unhide, delete a post
export async function POST(req: NextRequest) {
  const studentId = await effectiveStudentId();
  if (!studentId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { postId, action } = await req.json();
  if (!postId || !["hide", "unhide", "delete"].includes(action)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const post = await prisma.groupPost.findUnique({ where: { id: postId } });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!(await isGroupMod(post.groupId, studentId))) {
    return NextResponse.json({ error: "Not a moderator" }, { status: 403 });
  }

  if (action === "delete") {
    await prisma.groupPost.delete({ where: { id: postId } });
  } else if (action === "hide") {
    await prisma.groupPost.update({
      where: { id: postId },
      data: { hidden: true, hiddenAt: new Date(), hiddenBy: studentId },
    });
  } else if (action === "unhide") {
    await prisma.groupPost.update({
      where: { id: postId },
      data: { hidden: false, hiddenAt: null, hiddenBy: null },
    });
  }

  return NextResponse.json({ success: true });
}
