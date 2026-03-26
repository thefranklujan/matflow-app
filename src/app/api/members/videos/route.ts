import { NextRequest, NextResponse } from "next/server";
import { requireMember } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { gymId } = await requireMember();

    const { searchParams } = new URL(req.url);
    const classType = searchParams.get("classType");

    const where: Record<string, unknown> = { gymId, published: true };
    if (classType) {
      where.classType = classType;
    }

    const videos = await prisma.video.findMany({
      where,
      orderBy: { classDate: "desc" },
    });

    return NextResponse.json(videos);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
