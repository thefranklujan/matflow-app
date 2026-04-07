export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { effectiveStudentId } from "@/lib/community-auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const studentId = await effectiveStudentId();
  if (!studentId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { date } = await req.json();
  if (!date) return NextResponse.json({ error: "Missing date" }, { status: 400 });

  const day = new Date(date);
  day.setUTCHours(0, 0, 0, 0);

  // Toggle: delete if exists, otherwise create
  const existing = await prisma.studentTrainingPlan.findUnique({
    where: { studentId_date: { studentId, date: day } },
  });
  if (existing) {
    await prisma.studentTrainingPlan.delete({ where: { id: existing.id } });
    return NextResponse.json({ marked: false });
  }
  await prisma.studentTrainingPlan.create({ data: { studentId, date: day } });
  return NextResponse.json({ marked: true });
}
