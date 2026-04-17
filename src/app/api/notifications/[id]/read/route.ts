export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/local-auth";
import { prisma } from "@/lib/prisma";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const aliases = [session.userId, session.studentId ? `student-${session.studentId}` : ""].filter(
    Boolean
  );

  await prisma.notification.updateMany({
    where: { id, externalId: { in: aliases }, readAt: null },
    data: { readAt: new Date() },
  });

  return NextResponse.json({ success: true });
}
