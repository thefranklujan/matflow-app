import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireOwnerAccess, entitlementErrorBody } from "@/lib/owner-access";

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
  let gymId: string;
  try {
    // Creating classes requires a usable (not locked-out) academy account.
    ({ gymId } = await requireOwnerAccess());
  } catch (err) {
    const entitlement = entitlementErrorBody(err);
    if (entitlement) return NextResponse.json(entitlement, { status: 402 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { dayOfWeek, startTime, endTime, classType, instructor, instructorId, locationSlug, topic } = body;

    if (
      typeof dayOfWeek !== "number" ||
      !startTime ||
      !endTime ||
      !classType ||
      !instructor
    ) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // If an instructor was picked from the roster, verify it belongs to this gym.
    let resolvedInstructorId: string | null = null;
    if (instructorId) {
      const instr = await prisma.instructor.findFirst({ where: { id: instructorId, gymId } });
      if (!instr) {
        return NextResponse.json({ error: "Invalid instructor" }, { status: 400 });
      }
      resolvedInstructorId = instr.id;
    }

    const entry = await prisma.classSchedule.create({
      data: {
        dayOfWeek,
        startTime,
        endTime,
        classType,
        instructor, // legacy display name, always set
        instructorId: resolvedInstructorId,
        locationSlug: locationSlug || "main",
        topic: topic || null,
        gymId,
      },
    });

    return NextResponse.json(entry, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create class" }, { status: 500 });
  }
}
