import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireOwnerAccess, entitlementErrorBody } from "@/lib/owner-access";
import { validateScheduleInput } from "@/lib/schedule-validation";

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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON.", code: "INVALID_BODY", field: "body" },
      { status: 400 },
    );
  }

  // Shape/format validation happens BEFORE any database work, so an invalid
  // submission can never write a row or surface as a generic 500.
  const validated = validateScheduleInput(body);
  if (!validated.ok) {
    return NextResponse.json(
      { error: validated.error.message, code: validated.error.code, field: validated.error.field },
      { status: 400 },
    );
  }
  const input = validated.value;

  try {
    // If an instructor was picked from the roster, it must belong to THIS
    // academy — a cross-tenant id is rejected, never silently accepted.
    let resolvedInstructorId: string | null = null;
    if (input.instructorId) {
      const instr = await prisma.instructor.findFirst({
        where: { id: input.instructorId, gymId },
        select: { id: true },
      });
      if (!instr) {
        return NextResponse.json(
          { error: "That instructor is not part of your academy.", code: "INVALID_INSTRUCTOR", field: "instructorId" },
          { status: 400 },
        );
      }
      resolvedInstructorId = instr.id;
    }

    const entry = await prisma.classSchedule.create({
      data: {
        dayOfWeek: input.dayOfWeek,
        startTime: input.startTime,
        endTime: input.endTime,
        classType: input.classType,
        instructor: input.instructor, // legacy display name, always set
        instructorId: resolvedInstructorId,
        locationSlug: input.locationSlug,
        topic: input.topic,
        gymId,
      },
    });

    return NextResponse.json(entry, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create class" }, { status: 500 });
  }
}
