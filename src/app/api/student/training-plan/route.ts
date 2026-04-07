export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { effectiveStudentId } from "@/lib/community-auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const studentId = await effectiveStudentId();
  if (!studentId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { date, morning, noon, afternoon, gym } = await req.json();
  if (!date) return NextResponse.json({ error: "Missing date" }, { status: 400 });

  const day = new Date(date);
  day.setUTCHours(0, 0, 0, 0);

  const data = {
    morning: !!morning,
    noon: !!noon,
    afternoon: !!afternoon,
    gym: gym || null,
  };

  // If no time blocks selected, treat as deletion
  if (!data.morning && !data.noon && !data.afternoon) {
    await prisma.studentTrainingPlan.deleteMany({ where: { studentId, date: day } });
    return NextResponse.json({ deleted: true });
  }

  const plan = await prisma.studentTrainingPlan.upsert({
    where: { studentId_date: { studentId, date: day } },
    create: { studentId, date: day, ...data },
    update: data,
  });

  return NextResponse.json({ plan });
}

export async function DELETE(req: NextRequest) {
  const studentId = await effectiveStudentId();
  if (!studentId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  if (!date) return NextResponse.json({ error: "Missing date" }, { status: 400 });

  const day = new Date(date);
  day.setUTCHours(0, 0, 0, 0);

  await prisma.studentTrainingPlan.deleteMany({ where: { studentId, date: day } });
  return NextResponse.json({ success: true });
}
