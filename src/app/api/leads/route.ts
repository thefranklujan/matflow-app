export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET: Admin fetches all leads
export async function GET() {
  try {
    const { gymId } = await requireAdmin();
    const leads = await prisma.lead.findMany({
      where: { gymId },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(leads);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

// POST: Public lead capture (from landing page demo form)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { firstName, lastName, email, phone, gymSlug, source } = body;

    if (!firstName || !lastName || !email) {
      return NextResponse.json({ error: "Name and email required" }, { status: 400 });
    }

    // Find the gym by slug, or use default
    let gymId: string;
    if (gymSlug) {
      const gym = await prisma.gym.findUnique({ where: { slug: gymSlug } });
      if (!gym) return NextResponse.json({ error: "Gym not found" }, { status: 404 });
      gymId = gym.id;
    } else {
      // For general MatFlow leads (no specific gym), use the first gym or reject
      const gym = await prisma.gym.findFirst();
      if (!gym) return NextResponse.json({ error: "No gym available" }, { status: 400 });
      gymId = gym.id;
    }

    const lead = await prisma.lead.create({
      data: {
        gymId,
        firstName,
        lastName,
        email,
        phone: phone || null,
        source: source || "website",
        status: "new",
      },
    });

    return NextResponse.json({ success: true, id: lead.id }, { status: 201 });
  } catch (error) {
    console.error("Lead capture error:", error);
    return NextResponse.json({ error: "Failed to capture lead" }, { status: 500 });
  }
}
