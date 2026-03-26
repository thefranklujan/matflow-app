import { NextResponse } from "next/server";
import { requireMember } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const { gymId, memberId } = await requireMember();

    const progress = await prisma.techniqueProgress.findMany({
      where: { gymId, memberId },
      select: { techniqueId: true, completedAt: true, verifiedBy: true },
    });

    return NextResponse.json(progress);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
