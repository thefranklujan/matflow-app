export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSession } from "@/lib/local-auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const aliases = [session.userId, session.studentId ? `student-${session.studentId}` : ""].filter(
    Boolean
  );

  const result = await prisma.notification.updateMany({
    where: { externalId: { in: aliases }, readAt: null },
    data: { readAt: new Date() },
  });

  return NextResponse.json({ marked: result.count });
}
