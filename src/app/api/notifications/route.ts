export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSession } from "@/lib/local-auth";
import { prisma } from "@/lib/prisma";

/**
 * Inbox feed for the logged-in user. Returns notifications ordered newest
 * first, keyed by their OneSignal external_id aliases (userId + student id).
 */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ notifications: [], unread: 0 }, { status: 401 });

  const aliases = [session.userId, session.studentId ? `student-${session.studentId}` : ""].filter(
    Boolean
  );

  const [notifications, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { externalId: { in: aliases } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.notification.count({
      where: { externalId: { in: aliases }, readAt: null },
    }),
  ]);

  return NextResponse.json({ notifications, unread });
}
