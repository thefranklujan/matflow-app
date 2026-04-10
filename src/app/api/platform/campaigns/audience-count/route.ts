export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/local-auth";
import { prisma } from "@/lib/prisma";

const PLATFORM_ADMINS = (process.env.PLATFORM_ADMIN_EMAILS || "matflow@craftedsystems.io")
  .split(",")
  .map((e) => e.trim().toLowerCase());

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || !PLATFORM_ADMINS.includes(session.email.trim().toLowerCase())) {
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
  } else if (audience.startsWith("database_leads")) {
    const stateMatch = audience.match(/^database_leads_(.+)$/);
    const where: Record<string, unknown> = { email: { not: null } };
    if (stateMatch) where.state = stateMatch[1];
    count = await prisma.gymDatabase.count({ where });
  }

  return NextResponse.json({ count });
}
