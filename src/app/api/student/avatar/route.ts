export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { effectiveStudentId } from "@/lib/community-auth";

export async function POST(req: NextRequest) {
  try {
    const studentId = await effectiveStudentId();
    if (!studentId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.error("[avatar] BLOB_READ_WRITE_TOKEN is not set in env");
      return NextResponse.json(
        { error: "Server not configured for uploads (missing BLOB_READ_WRITE_TOKEN)" },
        { status: 500 }
      );
    }

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

    const ext = file.type.split("/")[1];
    const blob = await put(`avatars/${studentId}-${Date.now()}.${ext}`, file, {
      access: "public",
      addRandomSuffix: false,
    });

    await prisma.student.update({
      where: { id: studentId },
      data: { avatarUrl: blob.url },
    });

    return NextResponse.json({ url: blob.url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[avatar] upload failed:", msg);
    return NextResponse.json({ error: `Upload failed: ${msg}` }, { status: 500 });
  }
}
