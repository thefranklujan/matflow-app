export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireStudentMembership, StaleMembershipError } from "@/lib/student-membership";
import { verifyArrivalToken, ArrivalTokenError } from "@/lib/arrival-token";
import { occurrenceForSlot, type ScheduleSlot } from "@/lib/class-window";
import { logActivity } from "@/lib/activity-log";
import { maybeNotifyStreakMilestone } from "@/lib/attendance-streak";

/**
 * Student self-check-in: turns a verified arrival + an explicit class choice
 * into a real Attendance record.
 *
 * Trust model: the client supplies ONLY the arrival attestation and a
 * classScheduleId. Everything Attendance-shaped (gymId, memberId, classType,
 * classDate, locationSlug) is derived server-side from the freshly resolved
 * membership and the schedule row — client values are never authoritative.
 * The occurrence window is re-validated here independently of the proximity
 * endpoint's earlier answer.
 *
 * No owner push is sent: the owner sees confirmed attendance through the
 * normal attendance and analytics views.
 */

export async function POST(req: NextRequest) {
  let membership;
  try {
    membership = await requireStudentMembership();
  } catch (err) {
    if (err instanceof StaleMembershipError) {
      if (err.code === "not_student") {
        return NextResponse.json({ error: "Not signed in as a student" }, { status: 401 });
      }
      return NextResponse.json({ result: "no_active_membership" }, { status: 409 });
    }
    return NextResponse.json({ error: "Unavailable" }, { status: 500 });
  }
  const { studentId, member, gym } = membership;

  const body = await req.json().catch(() => ({}));
  const { arrivalToken, classScheduleId } = body as { arrivalToken?: unknown; classScheduleId?: unknown };

  if (typeof arrivalToken !== "string" || typeof classScheduleId !== "string" || !classScheduleId) {
    return NextResponse.json({ error: "arrivalToken and classScheduleId required" }, { status: 400 });
  }

  try {
    await verifyArrivalToken(arrivalToken, { studentId, memberId: member.id, gymId: gym.id });
  } catch (err) {
    if (err instanceof ArrivalTokenError) {
      // "expired" tells the client to obtain a fresh proximity decision;
      // everything else is a hard rejection.
      const code = err.code === "expired" ? "token_expired" : "token_invalid";
      return NextResponse.json({ result: code }, { status: 401 });
    }
    return NextResponse.json({ error: "Unavailable" }, { status: 500 });
  }

  // The schedule must belong to THIS gym and still be active.
  const schedule = await prisma.classSchedule.findFirst({
    where: { id: classScheduleId, gymId: gym.id, active: true },
    select: {
      id: true,
      dayOfWeek: true,
      startTime: true,
      endTime: true,
      classType: true,
      instructor: true,
      locationSlug: true,
    },
  });
  if (!schedule) {
    return NextResponse.json({ result: "class_not_found" }, { status: 404 });
  }

  // Re-validate the occurrence window in the academy's timezone, independent
  // of what the proximity endpoint said earlier.
  const occurrence = occurrenceForSlot(schedule as ScheduleSlot, new Date(), gym.timezone);
  if (!occurrence) {
    return NextResponse.json({ result: "outside_window" }, { status: 409 });
  }

  const attendanceData = {
    gymId: gym.id,
    memberId: member.id,
    classDate: occurrence.classDate,
    classType: occurrence.classType,
    locationSlug: occurrence.locationSlug,
  };

  try {
    await prisma.attendance.create({ data: attendanceData });
  } catch (err) {
    // Unique collision on [gymId, memberId, classDate, classType]: either the
    // same check-in repeated (idempotent success) or — because locationSlug is
    // NOT part of the unique key — a record for the SAME class at a DIFFERENT
    // location. The latter must surface as a clear conflict, never be silently
    // reported as the selected class.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const existing = await prisma.attendance.findFirst({
        where: {
          gymId: gym.id,
          memberId: member.id,
          classDate: occurrence.classDate,
          classType: occurrence.classType,
        },
        select: { locationSlug: true },
      });
      if (existing && existing.locationSlug !== occurrence.locationSlug) {
        return NextResponse.json(
          { result: "location_conflict", existingLocation: existing.locationSlug },
          { status: 409 },
        );
      }
      return NextResponse.json({
        result: "already_checked_in",
        classType: occurrence.classType,
        startTime: occurrence.startTime,
      });
    }
    throw err;
  }

  // New check-in: activity log (self-check-in explicitly distinguished from
  // admin check-in; no coordinates anywhere) + streak milestones.
  logActivity({
    gymId: gym.id,
    action: "self_check_in",
    actorId: member.id,
    actorName: `${member.firstName} ${member.lastName}`,
    meta: {
      classType: occurrence.classType,
      startTime: occurrence.startTime,
      classDate: occurrence.classDate.toISOString().slice(0, 10),
      locationSlug: occurrence.locationSlug,
    },
  });
  maybeNotifyStreakMilestone({ memberId: member.id, gymId: gym.id }).catch((e) =>
    console.error("[self_check_in streak] failed:", e),
  );

  return NextResponse.json(
    {
      result: "checked_in",
      classType: occurrence.classType,
      startTime: occurrence.startTime,
      endTime: occurrence.endTime,
    },
    { status: 201 },
  );
}
