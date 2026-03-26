import { NextRequest, NextResponse } from "next/server";
import { requireMember } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const { gymId, memberId } = await requireMember();

    const member = await prisma.member.findFirst({
      where: { id: memberId, gymId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        beltRank: true,
        stripes: true,
        locationSlug: true,
        createdAt: true,
      },
    });

    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    return NextResponse.json(member);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { gymId, memberId } = await requireMember();

    const body = await req.json();
    const { firstName, lastName, phone } = body;

    if (!firstName || !lastName) {
      return NextResponse.json(
        { error: "First name and last name are required" },
        { status: 400 }
      );
    }

    // Verify ownership before update
    const existing = await prisma.member.findFirst({
      where: { id: memberId, gymId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    const member = await prisma.member.update({
      where: { id: memberId },
      data: {
        firstName,
        lastName,
        phone: phone || null,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        beltRank: true,
        stripes: true,
        locationSlug: true,
        createdAt: true,
      },
    });

    return NextResponse.json(member);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
