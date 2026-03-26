import { NextRequest, NextResponse } from "next/server";
import { requireMember } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const { gymId, memberId } = await requireMember();

    const { classDate, classType, locationSlug } = await request.json();
    if (!classDate || !classType || !locationSlug) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const commitment = await prisma.scheduleCommitment.upsert({
      where: {
        gymId_memberId_classDate_classType: {
          gymId,
          memberId,
          classDate: new Date(classDate),
          classType,
        },
      },
      update: {},
      create: {
        gymId,
        memberId,
        classDate: new Date(classDate),
        classType,
        locationSlug,
      },
    });

    return NextResponse.json(commitment, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { gymId, memberId } = await requireMember();

    const { classDate, classType } = await request.json();

    await prisma.scheduleCommitment.deleteMany({
      where: {
        gymId,
        memberId,
        classDate: new Date(classDate),
        classType,
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
