export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/local-auth";
import { prisma } from "@/lib/prisma";

const PLATFORM_ADMINS = (process.env.PLATFORM_ADMIN_EMAILS || "matflow@craftedsystems.io")
  .split(",").map(e => e.trim());

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !PLATFORM_ADMINS.includes(session.email)) {
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
