export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET: Get gym branding info (public)
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;

    const gym = await prisma.gym.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        logo: true,
        primaryColor: true,
        secondaryColor: true,
        phone: true,
        website: true,
      },
    });

    if (!gym) return NextResponse.json({ error: "Gym not found" }, { status: 404 });

    return NextResponse.json({ gym });
  } catch {
    return NextResponse.json({ error: "Failed to load" }, { status: 500 });
  }
}

// POST: Check in a member by their code (public)
export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const { code } = await request.json();

    if (!code) {
      return NextResponse.json({ error: "Check-in code required" }, { status: 400 });
    }

    const gym = await prisma.gym.findUnique({ where: { slug }, select: { id: true } });
    if (!gym) return NextResponse.json({ error: "Gym not found" }, { status: 404 });

    const member = await prisma.member.findFirst({
      where: { gymId: gym.id, checkinCode: code, active: true },
      select: { id: true, firstName: true, lastName: true, beltRank: true, stripes: true },
    });

    if (!member) {
      return NextResponse.json({ error: "Invalid code" }, { status: 404 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if already checked in today
    const existing = await prisma.attendance.findFirst({
      where: {
        gymId: gym.id,
        memberId: member.id,
        classDate: today,
        classType: "training",
      },
    });

    if (existing) {
      return NextResponse.json({
        success: true,
        alreadyCheckedIn: true,
        member: {
          name: `${member.firstName} ${member.lastName}`,
          belt: member.beltRank,
          stripes: member.stripes,
        },
      });
    }

    await prisma.attendance.create({
      data: {
        gymId: gym.id,
        memberId: member.id,
        classDate: today,
        classType: "training",
        locationSlug: "main",
      },
    });

    return NextResponse.json({
      success: true,
      alreadyCheckedIn: false,
      member: {
        name: `${member.firstName} ${member.lastName}`,
        belt: member.beltRank,
        stripes: member.stripes,
      },
    });
  } catch (error) {
    console.error("Kiosk check-in error:", error);
    return NextResponse.json({ error: "Check-in failed" }, { status: 500 });
  }
}
