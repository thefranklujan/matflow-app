import { NextRequest, NextResponse } from "next/server";
import { requireMember } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { gymId, memberId } = await requireMember();
    const { id } = await params;

    const goal = await prisma.personalGoal.findFirst({
      where: { id, gymId, memberId },
    });
    if (!goal) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await request.json();
    const data: Record<string, unknown> = {};

    if (body.currentValue !== undefined) {
      data.currentValue = parseInt(body.currentValue, 10);
    }
    if (body.completed !== undefined) {
      data.completed = Boolean(body.completed);
    }

    const updated = await prisma.personalGoal.update({
      where: { id },
      data,
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { gymId, memberId } = await requireMember();
    const { id } = await params;

    const goal = await prisma.personalGoal.findFirst({
      where: { id, gymId, memberId },
    });
    if (!goal) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.personalGoal.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
