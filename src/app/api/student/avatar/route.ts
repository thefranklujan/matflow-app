export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { effectiveStudentId } from "@/lib/community-auth";

export async function POST(req: NextRequest) {
  const studentId = await effectiveStudentId();
  if (!studentId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(file.type)) {
    return NextResponse.json({ error: "Use JPG, PNG, or WebP" }, { status: 400 });
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "Max 5MB" }, { status: 400 });
  }

  const blob = await put(`avatars/${studentId}-${Date.now()}.${file.type.split("/")[1]}`, file, {
    access: "public",
    addRandomSuffix: false,
  });

  await prisma.student.update({
    where: { id: studentId },
    data: { avatarUrl: blob.url },
  });

  return NextResponse.json({ url: blob.url });
}
