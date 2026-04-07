import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { gymId } = await requireAdmin();

    const { id } = await params;

    const member = await prisma.member.findFirst({
      where: { id, gymId },
      include: {
        beltHistory: { orderBy: { awardedAt: "desc" } },
      },
    });

    if (!member) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const attendanceCount = await prisma.attendance.count({
      where: { memberId: id, gymId },
    });

    return NextResponse.json({ ...member, attendanceCount });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { gymId } = await requireAdmin();

    const { id } = await params;
    const body = await req.json();

    // Verify ownership
    const existing = await prisma.member.findFirst({ where: { id, gymId } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (typeof body.approved === "boolean") data.approved = body.approved;
    if (typeof body.active === "boolean") data.active = body.active;
    if (body.beltRank) data.beltRank = body.beltRank;
    if (typeof body.stripes === "number") data.stripes = body.stripes;
    if (typeof body.isAmbassador === "boolean") data.isAmbassador = body.isAmbassador;

    const member = await prisma.member.update({
      where: { id },
      data,
    });

    return NextResponse.json(member);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
