import { NextResponse } from "next/server";
import { requireMember } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const { gymId } = await requireMember();

    const schedule = await prisma.classSchedule.findMany({
      where: { gymId, active: true },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });

    return NextResponse.json(schedule);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
