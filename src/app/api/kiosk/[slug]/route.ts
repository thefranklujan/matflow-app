export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET: Get today's classes for this gym (public)
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;

    const gym = await prisma.gym.findUnique({ where: { slug }, select: { id: true, name: true } });
    if (!gym) return NextResponse.json({ error: "Gym not found" }, { status: 404 });

    const today = new Date();
    const dayOfWeek = today.getDay();

    const classes = await prisma.classSchedule.findMany({
      where: { gymId: gym.id, dayOfWeek, active: true },
      orderBy: { startTime: "asc" },
    });

    return NextResponse.json({ gym: { name: gym.name }, classes });
  } catch {
    return NextResponse.json({ error: "Failed to load" }, { status: 500 });
  }
}

// POST: Check in a member by email (public)
export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const { email, classType } = await request.json();

    if (!email || !classType) {
      return NextResponse.json({ error: "Email and class type required" }, { status: 400 });
    }

    const gym = await prisma.gym.findUnique({ where: { slug }, select: { id: true } });
    if (!gym) return NextResponse.json({ error: "Gym not found" }, { status: 404 });

    const member = await prisma.member.findFirst({
      where: { gymId: gym.id, email, active: true },
      select: { id: true, firstName: true, lastName: true, beltRank: true, stripes: true },
    });

    if (!member) {
      return NextResponse.json({ error: "Member not found. Check your email or ask the front desk." }, { status: 404 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if already checked in
    const existing = await prisma.attendance.findFirst({
      where: {
        gymId: gym.id,
        memberId: member.id,
        classDate: today,
        classType,
      },
    });

    if (existing) {
      return NextResponse.json({
        success: true,
        alreadyCheckedIn: true,
        member: { name: `${member.firstName} ${member.lastName}`, belt: member.beltRank, stripes: member.stripes },
      });
    }

    await prisma.attendance.create({
      data: {
        gymId: gym.id,
        memberId: member.id,
        classDate: today,
        classType,
        locationSlug: "main",
      },
    });

    return NextResponse.json({
      success: true,
      alreadyCheckedIn: false,
      member: { name: `${member.firstName} ${member.lastName}`, belt: member.beltRank, stripes: member.stripes },
    });
  } catch (error) {
    console.error("Kiosk check-in error:", error);
    return NextResponse.json({ error: "Check-in failed" }, { status: 500 });
  }
}
