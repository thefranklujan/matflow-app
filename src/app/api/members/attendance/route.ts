import { NextResponse } from "next/server";
import { requireMember } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const { gymId, memberId } = await requireMember();

    const attendance = await prisma.attendance.findMany({
      where: { gymId, memberId },
      orderBy: { classDate: "desc" },
    });

    return NextResponse.json(attendance);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
