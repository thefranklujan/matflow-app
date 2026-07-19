import { NextRequest, NextResponse } from "next/server";
import { requireOwnerAccess, entitlementErrorBody } from "@/lib/owner-access";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { gymId } = await requireOwnerAccess();

    const { id: memberId } = await params;
    const { techniqueId } = await request.json();

    if (!techniqueId) {
      return NextResponse.json({ error: "techniqueId required" }, { status: 400 });
    }

    // Verify member belongs to this gym
    const member = await prisma.member.findFirst({ where: { id: memberId, gymId } });
    if (!member) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const record = await prisma.techniqueProgress.upsert({
      where: {
        gymId_memberId_techniqueId: { gymId, memberId, techniqueId },
      },
      update: {},
      create: {
        memberId,
        techniqueId,
        verifiedBy: "admin",
        gymId,
      },
    });

    logActivity({ gymId, action: "technique_verified", actorName: "Admin", targetId: memberId, targetName: `${member.firstName} ${member.lastName}`, meta: { techniqueId } });

    return NextResponse.json(record, { status: 201 });
  } catch (err) {
    const entitlement = entitlementErrorBody(err);
    if (entitlement) return NextResponse.json(entitlement, { status: 402 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { gymId } = await requireOwnerAccess();

    const { id: memberId } = await params;
    const { techniqueId } = await request.json();

    // Verify member belongs to this gym
    const member = await prisma.member.findFirst({ where: { id: memberId, gymId } });
    if (!member) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.techniqueProgress.deleteMany({
      where: { memberId, techniqueId, gymId },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const entitlement = entitlementErrorBody(err);
    if (entitlement) return NextResponse.json(entitlement, { status: 402 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
