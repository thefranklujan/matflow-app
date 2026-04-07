export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/local-auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.studentId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { date, duration, sessionType, techniques, partners, notes, rollsWon, rollsLost } = body;

  if (!date || !sessionType) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const entry = await prisma.trainingSession.create({
    data: {
      studentId: session.studentId,
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
  return NextResponse.json(entry, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session?.studentId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  await prisma.trainingSession.deleteMany({ where: { id, studentId: session.studentId } });
  return NextResponse.json({ success: true });
}
