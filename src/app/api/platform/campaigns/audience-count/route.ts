export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getPlatformAdminSession } from "@/lib/platform-admin";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getPlatformAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const audience = new URL(req.url).searchParams.get("audience") || "";
  let count = 0;

  if (audience === "test") {
    count = 1;
  } else if (audience === "all_students") {
    count = await prisma.student.count({ where: { email: { not: "" } } });
  } else if (audience === "all_admins") {
    count = await prisma.gym.count({ where: { id: { notIn: ["platform-owner-gym", "platform-admin-gym"] } } });
  } else if (audience === "database_leads_unsent") {
    const allSent = await prisma.campaignEvent.findMany({
      where: { event: "sent" },
      select: { email: true },
      distinct: ["email"],
    });
    const sentSet = new Set(allSent.map(e => e.email));
    const leads = await prisma.gymDatabase.findMany({
      where: { email: { not: null } },
      select: { email: true },
    });
    count = leads.filter(l => l.email && !sentSet.has(l.email)).length;
  } else if (audience.startsWith("database_leads")) {
    const stateMatch = audience.match(/^database_leads_(.+)$/);
    const where: Record<string, unknown> = { email: { not: null } };
    if (stateMatch) where.state = stateMatch[1];
    count = await prisma.gymDatabase.count({ where });
  }

  return NextResponse.json({ count });
}
