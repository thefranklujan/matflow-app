import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnerAccess, entitlementErrorBody } from "@/lib/owner-access";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Schedule mutations require a usable (not locked-out) academy account.
    const { gymId } = await requireOwnerAccess();

    const { id } = await params;

    // Verify ownership
    const existing = await prisma.classSchedule.findFirst({ where: { id, gymId } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.classSchedule.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (err) {
    const entitlement = entitlementErrorBody(err);
    if (entitlement) return NextResponse.json(entitlement, { status: 402 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
