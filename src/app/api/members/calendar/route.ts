import { NextRequest, NextResponse } from "next/server";
import { requireMember } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { gymId, memberId } = await requireMember();

    const { searchParams } = request.nextUrl;
    const month = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1));
    const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));
    const location = searchParams.get("location") || "";
    const classType = searchParams.get("classType") || "";
    const eventType = searchParams.get("eventType") || "";

    const scheduleWhere: Record<string, unknown> = { gymId, active: true };
    if (location) scheduleWhere.locationSlug = location;
    if (classType) scheduleWhere.classType = classType;

    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

    const eventWhere: Record<string, unknown> = {
      gymId,
      active: true,
      date: { gte: startOfMonth, lte: endOfMonth },
    };
    if (location) eventWhere.locationSlug = location;
    if (eventType) eventWhere.eventType = eventType;

    // My attendance
    const myAttendanceWhere: Record<string, unknown> = {
      gymId,
      classDate: { gte: startOfMonth, lte: endOfMonth },
    };
    if (memberId) myAttendanceWhere.memberId = memberId;

    // All members' attendance (for showing who went to class)
    const allAttendanceWhere: Record<string, unknown> = {
      gymId,
      classDate: { gte: startOfMonth, lte: endOfMonth },
    };
    if (location) allAttendanceWhere.locationSlug = location;
    if (classType) allAttendanceWhere.classType = classType;

    // Commitments for the month
    const commitmentWhere: Record<string, unknown> = {
      gymId,
      classDate: { gte: startOfMonth, lte: endOfMonth },
    };
    if (location) commitmentWhere.locationSlug = location;
    if (classType) commitmentWhere.classType = classType;

    const [schedule, attendance, events, allAttendance, commitments] =
      await Promise.all([
        prisma.classSchedule.findMany({
          where: scheduleWhere,
          orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
        }),
        memberId
          ? prisma.attendance.findMany({
              where: myAttendanceWhere,
              orderBy: { classDate: "asc" },
            })
          : Promise.resolve([]),
        prisma.event.findMany({
          where: eventWhere,
          orderBy: { date: "asc" },
        }),
        prisma.attendance.findMany({
          where: allAttendanceWhere,
          orderBy: { classDate: "asc" },
          include: {
            member: { select: { id: true, firstName: true, lastName: true, beltRank: true } },
          },
        }),
        prisma.scheduleCommitment.findMany({
          where: commitmentWhere,
          include: {
            member: { select: { id: true, firstName: true, lastName: true, beltRank: true } },
          },
        }),
      ]);

    return NextResponse.json({
      schedule,
      attendance,
      events,
      allAttendance,
      commitments,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
