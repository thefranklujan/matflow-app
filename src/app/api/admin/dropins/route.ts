import { NextResponse } from "next/server";
import { requirePlan, entitlementErrorBody } from "@/lib/owner-access";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const { gymId } = await requirePlan("pro");
    const dropIns = await prisma.dropIn.findMany({
      where: { gymId },
      orderBy: { visitDate: "desc" },
      include: {
        signatures: { select: { id: true, signedAt: true } },
        instructorRef: { select: { name: true } },
      },
    });
    return NextResponse.json(dropIns);
  } catch (err) {
    const entitlement = entitlementErrorBody(err);
    if (entitlement) return NextResponse.json(entitlement, { status: 402 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
