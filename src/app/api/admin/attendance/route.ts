import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";

export async function GET(req: NextRequest) {
  try {
    const { gymId } = await requireAdmin();

    const { searchParams } = new URL(req.url);
    const classDate = searchParams.get("classDate");
    const classType = searchParams.get("classType");

    if (!classDate || !classType) {
      return NextResponse.json({ error: "classDate and classType required" }, { status: 400 });
    }

    // Match attendance for the given date (start of day to end of day)
    const dateStart = new Date(classDate);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(classDate);
    dateEnd.setHours(23, 59, 59, 999);

    const records = await prisma.attendance.findMany({
      where: {
        gymId,
        classType,
        classDate: {
          gte: dateStart,
          lte: dateEnd,
        },
      },
      include: { member: true },
    });

    return NextResponse.json(records);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { gymId } = await requireAdmin();

    const body = await req.json();
    const { classDate, classType, locationSlug, memberIds } = body;

    if (!classDate || !classType || !locationSlug || !Array.isArray(memberIds) || memberIds.length === 0) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const date = new Date(classDate);

    // Use createMany with skipDuplicates to handle members already checked in
    const result = await prisma.attendance.createMany({
      data: memberIds.map((memberId: string) => ({
        memberId,
        classDate: date,
        classType,
        locationSlug,
        gymId,
      })),
      skipDuplicates: true,
    });

    logActivity({ gymId, action: "check_in", actorName: "Admin", meta: { count: result.count, classType, classDate } });

    return NextResponse.json({ count: result.count }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
