export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/local-auth";
import { prisma } from "@/lib/prisma";

async function effectiveStudentId() {
  const session = await getSession();
  if (!session) return null;
  if (session.studentId) return session.studentId;
  if (session.memberId) {
    const m = await prisma.member.findUnique({ where: { id: session.memberId }, select: { studentId: true } });
    return m?.studentId || null;
  }
  return null;
}

export async function POST(req: NextRequest) {
  const studentId = await effectiveStudentId();
  if (!studentId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { date, duration, sessionType, techniques, partners, notes, rollsWon, rollsLost } = body;

  if (!date || !sessionType) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const entry = await prisma.trainingSession.create({
    data: {
      studentId,
      date: new Date(date),
      duration: typeof duration === "number" ? duration : 60,
      sessionType,
      techniques: techniques || null,
      partners: partners || null,
      notes: notes || null,
      rollsWon: typeof rollsWon === "number" ? rollsWon : 0,
      rollsLost: typeof rollsLost === "number" ? rollsLost : 0,
    },
  });

  const total = await prisma.trainingSession.count({ where: { studentId } });
  const MILESTONES: Record<number, string> = {
    1: "First Session!",
    10: "10 Sessions",
    25: "25 Sessions",
    50: "Half Century",
    100: "Century Club",
    250: "250 Sessions",
    500: "500 Sessions",
  };
  const milestone = MILESTONES[total]
    ? { count: total, label: MILESTONES[total] }
    : null;

  return NextResponse.json({ ...entry, milestone }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const studentId = await effectiveStudentId();
  if (!studentId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const date = searchParams.get("date");
  if (!id && !date) return NextResponse.json({ error: "Missing id or date" }, { status: 400 });

  if (id) {
    await prisma.trainingSession.deleteMany({ where: { id, studentId } });
  } else if (date) {
    // Delete all sessions for the given YYYY-MM-DD in the student's local day.
    const [y, m, d] = date.split("-").map(Number);
    const start = new Date(y, (m || 1) - 1, d || 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    await prisma.trainingSession.deleteMany({
      where: { studentId, date: { gte: start, lt: end } },
    });
  }
  return NextResponse.json({ success: true });
}
