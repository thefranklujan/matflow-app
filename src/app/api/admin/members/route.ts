import { NextResponse } from "next/server";
import { requireOwnerAccess, entitlementErrorBody } from "@/lib/owner-access";
import { prisma } from "@/lib/prisma";
import { MEMBER_SAFE_SELECT } from "@/lib/member-select";

export async function GET() {
  try {
    const { gymId } = await requireOwnerAccess();

    const members = await prisma.member.findMany({
      where: { gymId },
      select: MEMBER_SAFE_SELECT,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(members);
  } catch (err) {
    const entitlement = entitlementErrorBody(err);
    if (entitlement) return NextResponse.json(entitlement, { status: 402 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
