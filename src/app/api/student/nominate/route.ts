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
  const { gymName, city, state, ownerEmail, ownerPhone, notes } = body;
  if (!gymName) return NextResponse.json({ error: "Gym name required" }, { status: 400 });

  const nomination = await prisma.gymNomination.create({
    data: {
      studentId,
      gymName,
      city: city || null,
      state: state || null,
      ownerEmail: ownerEmail || null,
      ownerPhone: ownerPhone || null,
      notes: notes || null,
    },
  });
  return NextResponse.json(nomination, { status: 201 });
}
