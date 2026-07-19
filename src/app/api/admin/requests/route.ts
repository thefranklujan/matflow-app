export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireOwnerAccess, entitlementErrorBody } from "@/lib/owner-access";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const { gymId } = await requireOwnerAccess();
    const requests = await prisma.joinRequest.findMany({
      where: { gymId },
      include: { student: { select: { firstName: true, lastName: true, email: true, phone: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ requests });
  } catch (err) {
    const entitlement = entitlementErrorBody(err);
    if (entitlement) return NextResponse.json(entitlement, { status: 402 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
