import { NextResponse } from "next/server";
import { requireMember } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const { gymId } = await requireMember();

    const announcements = await prisma.announcement.findMany({
      where: { gymId },
      orderBy: [{ pinned: "desc" }, { publishedAt: "desc" }],
    });

    return NextResponse.json(announcements);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
