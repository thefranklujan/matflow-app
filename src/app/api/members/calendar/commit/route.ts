import { NextRequest, NextResponse } from "next/server";
import { requireMember } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeClassDate } from "@/lib/class-commitment";

/** Store every commitment at the canonical academy-local date (UTC midnight). */
async function canonicalDate(gymId: string, raw: unknown): Promise<Date | null> {
  const gym = await prisma.gym.findUnique({ where: { id: gymId }, select: { timezone: true } });
  return normalizeClassDate(raw, gym?.timezone || "America/Chicago");
}

export async function POST(request: NextRequest) {
  try {
    const { gymId, memberId } = await requireMember();

    const { classDate: rawDate, classType, locationSlug } = await request.json();
    const classDate = await canonicalDate(gymId, rawDate);
    if (!classDate || !classType || !locationSlug) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const commitment = await prisma.scheduleCommitment.upsert({
      where: {
        gymId_memberId_classDate_classType: {
          gymId,
          memberId,
          classDate,
          classType,
        },
      },
      update: {},
      create: {
        gymId,
        memberId,
        classDate,
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

    const { classDate: rawDate, classType } = await request.json();
    const classDate = await canonicalDate(gymId, rawDate);
    if (!classDate || !classType) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Remove the canonical row and any legacy browser-local-midnight row for
    // the same academy-local date (within ±14h of it).
    await prisma.scheduleCommitment.deleteMany({
      where: {
        gymId,
        memberId,
        classType,
        classDate: {
          gte: new Date(classDate.getTime() - 14 * 3600_000),
          lte: new Date(classDate.getTime() + 14 * 3600_000),
        },
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
