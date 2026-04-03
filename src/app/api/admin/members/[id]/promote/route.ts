import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendBeltPromotion } from "@/lib/email";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { gymId } = await requireAdmin();

    const { id } = await params;
    const body = await req.json();
    const { beltRank, stripes, note } = body;

    if (!beltRank || typeof stripes !== "number") {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Verify member belongs to this gym
    const existing = await prisma.member.findFirst({ where: { id, gymId } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Create belt progress record
    const beltProgress = await prisma.beltProgress.create({
      data: {
        memberId: id,
        beltRank,
        stripes,
        note: note || null,
        awardedBy: "admin",
        gymId,
      },
    });

    // Update the member's current belt and stripes
    await prisma.member.update({
      where: { id },
      data: { beltRank, stripes },
    });

    const gym = await prisma.gym.findUnique({ where: { id: gymId }, select: { name: true } });
    sendBeltPromotion(existing.email, `${existing.firstName} ${existing.lastName}`, beltRank, stripes, gym?.name || "Your Gym");

    return NextResponse.json(beltProgress, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
