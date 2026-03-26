export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const { gymId } = await requireAdmin();
    const gym = await prisma.gym.findUnique({
      where: { id: gymId },
      select: {
        name: true,
        slug: true,
        logo: true,
        primaryColor: true,
        secondaryColor: true,
        phone: true,
        website: true,
        timezone: true,
      },
    });
    return NextResponse.json({ data: gym });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { gymId } = await requireAdmin();
    const body = await request.json();

    const allowedFields = [
      "name", "logo", "primaryColor", "secondaryColor",
      "phone", "website", "timezone",
    ];

    const updateData: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (key in body) {
        updateData[key] = body[key];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    await prisma.gym.update({
      where: { id: gymId },
      data: updateData,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
