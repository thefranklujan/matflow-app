export const dynamic = "force-dynamic";

import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStudentMembership, StaleMembershipError } from "@/lib/student-membership";
import { eligibleClassesNow, type ScheduleSlot } from "@/lib/class-window";
import { signArrivalToken } from "@/lib/arrival-token";

/**
 * READ-ONLY proximity decision endpoint for student self-check-in.
 *
 * This endpoint decides — it never acts:
 * - no owner notification, no push,
 * - no Notification rows (the old "debounce marker" write is gone),
 * - no Attendance,
 * - the student's coordinates are never persisted or logged, and the gym's
 *   coordinates are never returned.
 *
 * An "inside" decision issues a 5-minute signed arrival attestation which the
 * separate check-in endpoint requires (and independently re-validates).
 */

// >500m accuracy circles are too unreliable for a trustworthy geofence call.
const MAX_ACCURACY_M = 500;

/**
 * Opaque, stable partition key for client-side cooldown storage. It lets a
 * shared device keep per-membership cooldowns without exposing any raw id,
 * credential, or coordinate. It is NOT an auth artifact — nothing verifies it.
 */
function membershipContextFor(studentId: string, memberId: string, gymId: string): string {
  return createHash("sha256").update(`${studentId}:${memberId}:${gymId}`).digest("hex").slice(0, 16);
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function membershipErrorResponse(err: unknown): NextResponse | null {
  if (err instanceof StaleMembershipError) {
    if (err.code === "not_student") {
      return NextResponse.json({ error: "Not signed in as a student" }, { status: 401 });
    }
    return NextResponse.json({ result: "no_active_membership" }, { status: 200 });
  }
  return null;
}

/**
 * GET: pre-location eligibility context. Lets the native UI decide whether to
 * ask for location AT ALL before triggering any OS permission prompt.
 * Returns no coordinates.
 */
export async function GET() {
  try {
    const { studentId, member, gym } = await requireStudentMembership();
    // NULL checks only — (0, 0) is a valid coordinate pair.
    if (gym.lat === null || gym.lng === null) {
      return NextResponse.json({ eligible: false, reason: "no_gym_coordinates" });
    }
    return NextResponse.json({
      eligible: true,
      gymName: gym.name,
      radiusM: gym.geofenceRadiusM,
      membershipContext: membershipContextFor(studentId, member.id, gym.id),
    });
  } catch (err) {
    const res = membershipErrorResponse(err);
    if (res) {
      return err instanceof StaleMembershipError && err.code === "no_active_membership"
        ? NextResponse.json({ eligible: false, reason: "no_active_membership" })
        : res;
    }
    return NextResponse.json({ error: "Unavailable" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let membership;
  try {
    membership = await requireStudentMembership();
  } catch (err) {
    const res = membershipErrorResponse(err);
    if (res) return res;
    return NextResponse.json({ error: "Unavailable" }, { status: 500 });
  }
  const { studentId, member, gym } = membership;

  const body = await req.json().catch(() => ({}));
  const { lat, lng, accuracy } = body as { lat?: unknown; lng?: unknown; accuracy?: unknown };

  // Strict numeric validation — finite and inside real-world ranges.
  if (typeof lat !== "number" || !Number.isFinite(lat) || lat < -90 || lat > 90) {
    return NextResponse.json({ error: "Valid latitude required" }, { status: 400 });
  }
  if (typeof lng !== "number" || !Number.isFinite(lng) || lng < -180 || lng > 180) {
    return NextResponse.json({ error: "Valid longitude required" }, { status: 400 });
  }
  if (accuracy !== undefined && (typeof accuracy !== "number" || !Number.isFinite(accuracy) || accuracy < 0)) {
    return NextResponse.json({ error: "Valid accuracy required" }, { status: 400 });
  }
  if (typeof accuracy === "number" && accuracy > MAX_ACCURACY_M) {
    return NextResponse.json({ result: "accuracy_too_low" });
  }

  // NULL checks only — zero is a valid coordinate value.
  if (gym.lat === null || gym.lng === null) {
    return NextResponse.json({ result: "no_gym_coordinates" });
  }

  const distance = haversineMeters(lat, lng, gym.lat, gym.lng);
  const radius = gym.geofenceRadiusM || 200;

  if (distance > radius) {
    // Rounded distance only; never the gym's coordinates.
    return NextResponse.json({ result: "outside", distanceM: Math.round(distance), radiusM: radius });
  }

  // Inside the geofence. Decide whether any class is in its check-in window
  // (academy timezone), and attest the arrival for the check-in endpoint.
  const schedules = await prisma.classSchedule.findMany({
    where: { gymId: gym.id, active: true },
    select: {
      id: true,
      dayOfWeek: true,
      startTime: true,
      endTime: true,
      classType: true,
      instructor: true,
      instructorId: true,
      locationSlug: true,
    },
  });

  const candidates = eligibleClassesNow(schedules as ScheduleSlot[], new Date(), gym.timezone);

  if (candidates.length === 0) {
    return NextResponse.json({ result: "inside_no_class", gymName: gym.name });
  }

  // Exclude occurrences this member already has an Attendance row for (same
  // unique tuple the check-in endpoint uses). A cleared device then can't
  // re-prompt for a check-in that could never create a new row anyway. This
  // deliberately matches the tuple WITHOUT locationSlug: confirming the same
  // occurrence at another location would be a location_conflict, not a new row.
  const recordedRows = await prisma.attendance.findMany({
    where: {
      gymId: gym.id,
      memberId: member.id,
      OR: candidates.map((c) => ({ classDate: c.classDate, classType: c.classType })),
    },
    select: { classDate: true, classType: true },
  });
  const recorded = new Set(recordedRows.map((r) => `${r.classDate.toISOString()}|${r.classType}`));
  const open = candidates.filter((c) => !recorded.has(`${c.classDate.toISOString()}|${c.classType}`));

  if (open.length === 0) {
    return NextResponse.json({ result: "inside_no_class", gymName: gym.name });
  }

  const arrivalToken = await signArrivalToken({ studentId, memberId: member.id, gymId: gym.id });

  return NextResponse.json({
    result: "inside_with_classes",
    gymName: gym.name,
    arrivalToken,
    classes: open.map((c) => ({
      scheduleId: c.scheduleId,
      classType: c.classType,
      instructor: c.instructor,
      locationSlug: c.locationSlug,
      startTime: c.startTime,
      endTime: c.endTime,
      minutesFromStart: c.minutesFromStart,
    })),
  });
}
