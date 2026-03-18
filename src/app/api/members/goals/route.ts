import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (
    !session ||
    (session.user.role !== "member" && session.user.role !== "admin")
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const memberId = session.user.memberId;

  const goals = await prisma.personalGoal.findMany({
    where: { memberId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(goals);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (
    !session ||
    (session.user.role !== "member" && session.user.role !== "admin")
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const memberId = session.user.memberId;
  if (!memberId) {
    return NextResponse.json({ error: "No member profile" }, { status: 403 });
  }

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
      memberId,
      title,
      targetValue: parseInt(targetValue, 10),
      goalType,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
    },
  });

  return NextResponse.json(goal, { status: 201 });
}
