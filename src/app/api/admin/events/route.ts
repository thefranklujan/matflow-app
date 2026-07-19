import { NextRequest, NextResponse } from "next/server";
import { requirePlan, entitlementErrorBody } from "@/lib/owner-access";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const { gymId } = await requirePlan("pro");

    const events = await prisma.event.findMany({
      where: { gymId },
      orderBy: { date: "desc" },
    });

    return NextResponse.json(events);
  } catch (err) {
    const entitlement = entitlementErrorBody(err);
    if (entitlement) return NextResponse.json(entitlement, { status: 402 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  let gymId: string;
  try {
    ({ gymId } = await requirePlan("pro"));
  } catch (err) {
    const entitlement = entitlementErrorBody(err);
    if (entitlement) return NextResponse.json(entitlement, { status: 402 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { title, description, date, endDate, eventType, locationSlug, instructorId } = body;

    if (!title || !date || !eventType || !locationSlug) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    let resolvedInstructorId: string | null = null;
    if (instructorId) {
      const instr = await prisma.instructor.findFirst({ where: { id: instructorId, gymId } });
      if (!instr) {
        return NextResponse.json({ error: "Invalid instructor" }, { status: 400 });
      }
      resolvedInstructorId = instr.id;
    }

    const event = await prisma.event.create({
      data: {
        title,
        description: description || null,
        date: new Date(date),
        endDate: endDate ? new Date(endDate) : null,
        eventType,
        locationSlug,
        instructorId: resolvedInstructorId,
        gymId,
      },
    });

    return NextResponse.json(event, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create event" }, { status: 500 });
  }
}
