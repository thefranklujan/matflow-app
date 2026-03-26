import { NextRequest, NextResponse } from "next/server";
import { requireMember } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const { gymId, memberId } = await requireMember();

    const goals = await prisma.personalGoal.findMany({
      where: { gymId, memberId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(goals);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { gymId, memberId } = await requireMember();

    const body = await request.json();
    const { title, targetValue, goalType, startDate, endDate } = body;

    if (!title || !targetValue || !goalType || !startDate) {
      return NextResponse.json(
        { error: "Title, target value, goal type, and start date are required." },
        { status: 400 }
      );
    }

    const goal = await prisma.personalGoal.create({
      data: {
        gymId,
        memberId,
        title,
        targetValue: parseInt(targetValue, 10),
        goalType,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
      },
    });

    return NextResponse.json(goal, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
