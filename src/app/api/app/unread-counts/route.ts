export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSession } from "@/lib/local-auth";
import { prisma } from "@/lib/prisma";

/**
 * Lightweight unread counter for sidebar badges. Polled every ~10s by the
 * client. Must be fast — use count() queries with WHERE-covered indexes only.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 200 });
  }

  const counts: Record<string, number> = {};

  // Gym owner / admin counts
  if (session.role === "admin" && session.gymId) {
    const [pendingRequests, pendingWaivers] = await Promise.all([
      prisma.joinRequest.count({
        where: { gymId: session.gymId, status: "pending" },
      }),
      // Members without a waiver signature (assumes waiverSignatures relation).
      // If no waiver templates exist, this is 0.
      prisma.member.count({
        where: {
          gymId: session.gymId,
          active: true,
          approved: true,
          waiverSignatures: { none: {} },
        },
      }).catch(() => 0),
    ]);

    counts.requests = pendingRequests;
    counts.waivers = pendingWaivers;
  }

  // Student counts
  if (session.userType === "student" && session.studentId) {
    const pending = await prisma.joinRequest.count({
      where: { studentId: session.studentId, status: "pending" },
    });
    counts.requests = pending;
  }

  return NextResponse.json({ counts });
}
