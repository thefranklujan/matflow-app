export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getPlatformAdminSession } from "@/lib/platform-admin";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await getPlatformAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { title, content, pinned } = await req.json();
  if (!title || !content) {
    return NextResponse.json({ error: "Title and content required" }, { status: 400 });
  }

  const gyms = await prisma.gym.findMany({ select: { id: true } });

  const created = await prisma.announcement.createMany({
    data: gyms.map((g) => ({
      gymId: g.id,
      title: `[MatFlow] ${title}`,
      content,
      pinned: !!pinned,
    })),
  });

  return NextResponse.json({ success: true, gymCount: gyms.length, created: created.count });
}
