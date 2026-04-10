export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/local-auth";
import { prisma } from "@/lib/prisma";

const PLATFORM_ADMINS = (process.env.PLATFORM_ADMIN_EMAILS || "matflow@craftedsystems.io")
  .split(",")
  .map(e => e.trim().toLowerCase());

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !PLATFORM_ADMINS.includes(session.email.trim().toLowerCase())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");
    const gymId = searchParams.get("gymId");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const cursor = searchParams.get("cursor");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);

    const where: Record<string, unknown> = {};
    if (gymId) where.gymId = gymId;
    if (action) where.action = action;
    if (from || to) {
      where.createdAt = {};
      if (from) (where.createdAt as Record<string, unknown>).gte = new Date(from);
      if (to) (where.createdAt as Record<string, unknown>).lte = new Date(to);
    }

    const logs = await prisma.activityLog.findMany({
      where,
      include: { gym: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = logs.length > limit;
    if (hasMore) logs.pop();

    return NextResponse.json({
      logs,
      nextCursor: hasMore ? logs[logs.length - 1]?.id : null,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
