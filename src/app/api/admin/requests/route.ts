export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const { gymId } = await requireAdmin();
    const requests = await prisma.joinRequest.findMany({
      where: { gymId },
      include: { student: { select: { firstName: true, lastName: true, email: true, phone: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ requests });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
