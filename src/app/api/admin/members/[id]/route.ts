import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { lockMemberCapacity, assertSeatAvailable, MemberLimitError } from "@/lib/member-capacity";

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

    // Reactivating an inactive member consumes a seat. The pre-transaction
    // `existing` row can be stale under concurrency, so when activation is
    // requested we re-read THIS member inside the locked transaction and only
    // charge a seat if it is still inactive at that moment. A concurrent
    // duplicate reactivation therefore becomes an idempotent no-op update.
    const member = data.active === true
      ? await prisma.$transaction(async (tx) => {
          await lockMemberCapacity(tx, gymId);
          const current = await tx.member.findFirst({ where: { id, gymId } });
          if (!current) return null; // deleted meanwhile -> 404 below
          if (!current.active) {
            await assertSeatAvailable(tx, gymId);
          }
          return tx.member.update({ where: { id }, data });
        })
      : await prisma.member.update({ where: { id }, data });

    if (!member) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(member);
  } catch (error) {
    if (error instanceof MemberLimitError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { gymId } = await requireAdmin();
    const { id } = await params;

    // Verify the member belongs to this gym before deleting
    const existing = await prisma.member.findFirst({ where: { id, gymId } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Cascades clean up attendance, belt progress, waivers, goals, etc.
    // The underlying Student record is preserved (onDelete: SetNull on studentId).
    await prisma.member.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
