import { NextResponse } from "next/server";
import { requireMember } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const { gymId, memberId } = await requireMember();

    const progress = await prisma.beltProgress.findMany({
      where: { gymId, memberId },
      orderBy: { awardedAt: "desc" },
    });

    return NextResponse.json(progress);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
