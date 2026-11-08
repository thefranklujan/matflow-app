export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getPlatformAdminSession } from "@/lib/platform-admin";
import { prisma } from "@/lib/prisma";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ studentId: string }> }) {
  const session = await getPlatformAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { studentId } = await params;
  try {
    // Nuke any gym Member records tied to this student first so the signup-block
    // check clears and platform admins can truly wipe the person out.
    await prisma.member.deleteMany({ where: { studentId } });
    await prisma.student.delete({ where: { id: studentId } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Delete student error:", e);
    const message = e instanceof Error ? e.message : "Failed to delete student";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
