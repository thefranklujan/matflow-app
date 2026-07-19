import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkMemberLimit } from "@/lib/billing";
import { logActivity } from "@/lib/activity-log";
import { requirePlan, entitlementErrorBody } from "@/lib/owner-access";
import { lockMemberCapacity, assertSeatAvailable, MemberLimitError } from "@/lib/member-capacity";

/**
 * Convert a drop-in into a gym member. Creates a roster Member from the captured
 * info (no password — the person can claim login later via the join link /
 * password reset). Idempotent: re-running returns the already-linked member.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let gymId: string;
  try {
    // Drop-ins are a Pro feature; conversion requires a Pro plan.
    ({ gymId } = await requirePlan("pro"));
  } catch (err) {
    const entitlement = entitlementErrorBody(err);
    if (entitlement) return NextResponse.json(entitlement, { status: 402 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const dropIn = await prisma.dropIn.findFirst({ where: { id, gymId } });
    if (!dropIn) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (dropIn.convertedMemberId) {
      return NextResponse.json({ success: true, memberId: dropIn.convertedMemberId, already: true });
    }

    if (!dropIn.email) {
      return NextResponse.json(
        { error: "This drop-in has no email. Add an email before converting." },
        { status: 400 }
      );
    }

    const email = dropIn.email.trim().toLowerCase();

    // If they already exist as a member here, just link to it.
    const existing = await prisma.member.findFirst({ where: { gymId, email } });
    if (existing) {
      await prisma.dropIn.update({ where: { id }, data: { convertedMemberId: existing.id } });
      return NextResponse.json({ success: true, memberId: existing.id, already: true });
    }

    const limit = await checkMemberLimit(gymId);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Your plan's member limit has been reached." },
        { status: 403 }
      );
    }

    // Authoritative capacity gate: re-checked inside the transaction under the
    // gym's advisory lock, together with the member creation and the drop-in
    // link, so concurrent conversions cannot exceed the plan limit.
    const member = await prisma.$transaction(async (tx) => {
      await lockMemberCapacity(tx, gymId);
      await assertSeatAvailable(tx, gymId);
      const created = await tx.member.create({
        data: {
          gymId,
          clerkUserId: `dropin-${Date.now()}`,
          email,
          phone: dropIn.phone,
          firstName: dropIn.firstName,
          lastName: dropIn.lastName,
          approved: true,
          active: true,
          beltRank: "white",
        },
      });
      await tx.dropIn.update({ where: { id }, data: { convertedMemberId: created.id } });
      return created;
    });

    logActivity({
      gymId,
      action: "dropin_converted",
      targetId: member.id,
      targetName: `${dropIn.firstName} ${dropIn.lastName}`,
    });

    return NextResponse.json({ success: true, memberId: member.id });
  } catch (error) {
    if (error instanceof MemberLimitError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Could not convert drop-in" }, { status: 500 });
  }
}
