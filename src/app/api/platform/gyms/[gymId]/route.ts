export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/local-auth";
import { prisma } from "@/lib/prisma";

const PLATFORM_ADMINS = (process.env.PLATFORM_ADMIN_EMAILS || "matflow@craftedsystems.io")
  .split(",").map(e => e.trim().toLowerCase());

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ gymId: string }> }) {
  const session = await getSession();
  if (!session || !PLATFORM_ADMINS.includes(session.email.trim().toLowerCase())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { gymId } = await params;

  try {
    await prisma.gym.delete({ where: { id: gymId } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Delete gym error:", e);
    return NextResponse.json({ error: "Failed to delete gym" }, { status: 500 });
  }
}
