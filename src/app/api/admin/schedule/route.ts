import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const { gymId } = await requireAdmin();

    const entries = await prisma.classSchedule.findMany({
      where: { gymId },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });

    return NextResponse.json(entries);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { gymId } = await requireAdmin();

    const body = await req.json();
    const { dayOfWeek, startTime, endTime, classType, instructor, locationSlug, topic } = body;

    if (
      typeof dayOfWeek !== "number" ||
      !startTime ||
      !endTime ||
      !classType ||
      !instructor
    ) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const entry = await prisma.classSchedule.create({
      data: {
        dayOfWeek,
        startTime,
        endTime,
        classType,
        instructor,
        locationSlug: locationSlug || "main",
        topic: topic || null,
        gymId,
      },
    });

    return NextResponse.json(entry, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
