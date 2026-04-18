export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/local-auth";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/push";

/**
 * Student client pings us when they're near their home gym.
 * We verify server-side that they're actually within the geofence radius
 * (defense-in-depth — never trust client proximity claims blindly),
 * then notify the gym owner and persist a ProximityEvent row so we can
 * debounce (don't spam the owner every 30s).
 *
 * Used by the Capacitor native wrapper on foreground + location change.
 */

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.studentId) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { lat, lng, accuracy } = body as { lat: number; lng: number; accuracy?: number };

  if (typeof lat !== "number" || typeof lng !== "number") {
    return NextResponse.json({ error: "lat/lng required" }, { status: 400 });
  }

  // Ignore very low-accuracy readings (>500m circle — too unreliable for a geofence)
  if (typeof accuracy === "number" && accuracy > 500) {
    return NextResponse.json({ result: "accuracy_too_low", accuracy }, { status: 200 });
  }

  // Find the student's home gym (their linked active Member record with a location)
  const member = await prisma.member.findFirst({
    where: { studentId: session.studentId, approved: true, active: true },
    include: {
      gym: {
        select: {
          id: true,
          name: true,
          lat: true,
          lng: true,
          geofenceRadiusM: true,
        },
      },
    },
  });

  if (!member || !member.gym.lat || !member.gym.lng) {
    return NextResponse.json({ result: "no_gym_or_no_coords" });
  }

  const distance = haversineMeters(lat, lng, member.gym.lat, member.gym.lng);
  const radius = member.gym.geofenceRadiusM || 200;

  if (distance > radius) {
    return NextResponse.json({ result: "outside", distance: Math.round(distance), radius });
  }

  // Inside the geofence — but debounce: only notify the owner once per hour per student
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentEvent = await prisma.notification.findFirst({
    where: {
      externalId: session.userId,
      kind: "arrived_at_gym",
      createdAt: { gte: oneHourAgo },
    },
    orderBy: { createdAt: "desc" },
  });

  if (recentEvent) {
    return NextResponse.json({
      result: "debounced",
      distance: Math.round(distance),
      lastNotified: recentEvent.createdAt,
    });
  }

  // Fire the owner a notification + log it via the notify() helper
  const owner = await prisma.member.findFirst({
    where: { gymId: member.gym.id },
    orderBy: { createdAt: "asc" },
  });

  if (owner) {
    await notify({
      externalIds: [
        owner.clerkUserId,
        owner.studentId ? `student-${owner.studentId}` : "",
      ].filter(Boolean),
      // Use an existing kind to keep the trigger catalog tight; reviewers
      // shouldn't see this in their own inbox because they're not the owner.
      kind: "announcement",
      title: `${member.firstName} arrived at ${member.gym.name}`,
      body: `Tap to view today's attendance.`,
      url: "/app/attendance",
      gymId: member.gym.id,
    });
  }

  // Log an "arrived_at_gym" marker so we don't re-notify within the hour
  await prisma.notification.create({
    data: {
      externalId: session.userId,
      gymId: member.gym.id,
      kind: "arrived_at_gym",
      title: `You're at ${member.gym.name}`,
      body: `Tap to log today's class.`,
      url: "/student/training",
      // Pre-mark as read so it doesn't bug the student's inbox (the UI
      // uses a separate in-app toast for this)
      readAt: new Date(),
    },
  });

  return NextResponse.json({
    result: "arrived",
    distance: Math.round(distance),
    radius,
    gymName: member.gym.name,
  });
}
