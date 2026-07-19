export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";
import { gymHasPlanFeature } from "@/lib/owner-access";

// Drop-ins are a Pro feature. The academy is derived server-side from its
// public slug; non-Pro academies decline generically (no billing details).
const NOT_ACCEPTING = { error: "This academy is not accepting drop-ins right now." };

// GET: public gym + active waiver for the drop-in form.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const gym = await prisma.gym.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true, logo: true, primaryColor: true },
  });
  if (!gym) {
    return NextResponse.json({ error: "Gym not found" }, { status: 404 });
  }
  if (!(await gymHasPlanFeature(gym.id, "pro"))) {
    return NextResponse.json(NOT_ACCEPTING, { status: 403 });
  }

  const waiver = await prisma.waiverTemplate.findFirst({
    where: { gymId: gym.id, active: true },
    select: { id: true, title: true, content: true, version: true },
  });

  return NextResponse.json({
    gym: { name: gym.name, slug: gym.slug, logo: gym.logo, primaryColor: gym.primaryColor },
    waiver,
  });
}

// POST: register a drop-in and (if a waiver is active) capture their signature.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const gym = await prisma.gym.findUnique({ where: { slug }, select: { id: true, name: true } });
    if (!gym) {
      return NextResponse.json({ error: "Gym not found" }, { status: 404 });
    }
    if (!(await gymHasPlanFeature(gym.id, "pro"))) {
      return NextResponse.json(NOT_ACCEPTING, { status: 403 });
    }

    const body = await req.json();
    const firstName = (body.firstName || "").trim();
    const lastName = (body.lastName || "").trim();
    if (!firstName || !lastName) {
      return NextResponse.json({ error: "First and last name are required" }, { status: 400 });
    }

    // If the gym has an active waiver, it must be signed to complete drop-in.
    const waiver = await prisma.waiverTemplate.findFirst({
      where: { gymId: gym.id, active: true },
    });
    const signedName = (body.signedName || "").trim();
    if (waiver) {
      if (!body.agree || !signedName) {
        return NextResponse.json(
          { error: "Please read and sign the waiver to continue." },
          { status: 400 }
        );
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const dropIn = await tx.dropIn.create({
        data: {
          gymId: gym.id,
          firstName,
          lastName,
          email: body.email?.trim() || null,
          phone: body.phone?.trim() || null,
          emergencyName: body.emergencyName?.trim() || null,
          emergencyPhone: body.emergencyPhone?.trim() || null,
          classType: body.classType?.trim() || null,
          instructorId: body.instructorId || null,
        },
      });

      if (waiver) {
        await tx.waiverSignature.create({
          data: {
            gymId: gym.id,
            dropInId: dropIn.id,
            templateId: waiver.id,
            version: waiver.version,
            signedName,
            waiverContentSnapshot: waiver.content,
          },
        });
      }

      return dropIn;
    });

    logActivity({
      gymId: gym.id,
      action: "dropin_registered",
      targetId: result.id,
      targetName: `${firstName} ${lastName}`,
    });

    return NextResponse.json({ success: true, signedWaiver: !!waiver }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Could not complete drop-in" }, { status: 500 });
  }
}
