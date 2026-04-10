export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/local-auth";
import { prisma } from "@/lib/prisma";

const PLATFORM_ADMINS = (process.env.PLATFORM_ADMIN_EMAILS || "matflow@craftedsystems.io")
  .split(",")
  .map(e => e.trim().toLowerCase());

async function requirePlatformAdmin() {
  const session = await getSession();
  if (!session || !PLATFORM_ADMINS.includes(session.email.trim().toLowerCase())) {
    throw new Error("Forbidden");
  }
  return session;
}

export async function GET() {
  try {
    await requirePlatformAdmin();

    const pendingGyms = await prisma.gym.findMany({
      where: {
        approved: false,
        id: { notIn: ["platform-owner-gym", "platform-admin-gym"] },
      },
      include: {
        members: {
          take: 1,
          orderBy: { createdAt: "asc" },
          select: { firstName: true, lastName: true, email: true },
        },
        _count: { select: { members: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ gyms: pendingGyms });
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requirePlatformAdmin();
    const { gymId, action } = await request.json();

    if (!gymId || !["approve", "reject"].includes(action)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    if (action === "approve") {
      await prisma.gym.update({
        where: { id: gymId },
        data: { approved: true },
      });
      return NextResponse.json({ success: true, action: "approved" });
    }

    if (action === "reject") {
      await prisma.gym.delete({ where: { id: gymId } });
      return NextResponse.json({ success: true, action: "rejected" });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Approve gym error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
