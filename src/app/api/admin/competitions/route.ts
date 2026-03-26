import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const { gymId } = await requireAdmin();

    const results = await prisma.competitionResult.findMany({
      where: { gymId },
      include: { member: true },
      orderBy: { date: "desc" },
    });

    return NextResponse.json(results);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { gymId } = await requireAdmin();

    const body = await req.json();
    const { memberId, competitionName, date, placement, division, notes } = body;

    if (!memberId || !competitionName || !date || !placement) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Verify member belongs to this gym
    const member = await prisma.member.findFirst({ where: { id: memberId, gymId } });
    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    const result = await prisma.competitionResult.create({
      data: {
        memberId,
        competitionName,
        date: new Date(date),
        placement,
        division: division || null,
        notes: notes || null,
        gymId,
      },
    });

    return NextResponse.json(result, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
