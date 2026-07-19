export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requirePlan, entitlementErrorBody } from "@/lib/owner-access";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { gymId } = await requirePlan("pro");
    const { id } = await params;
    const body = await request.json();

    const lead = await prisma.lead.findFirst({ where: { id, gymId } });
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

    const updated = await prisma.lead.update({
      where: { id },
      data: {
        status: body.status ?? lead.status,
        notes: body.notes ?? lead.notes,
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    const entitlement = entitlementErrorBody(err);
    if (entitlement) return NextResponse.json(entitlement, { status: 402 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { gymId } = await requirePlan("pro");
    const { id } = await params;

    const lead = await prisma.lead.findFirst({ where: { id, gymId } });
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

    await prisma.lead.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    const entitlement = entitlementErrorBody(err);
    if (entitlement) return NextResponse.json(entitlement, { status: 402 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
