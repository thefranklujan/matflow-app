export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/local-auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { gymName, slug, timezone } = body;

    if (!gymName || !slug) {
      return NextResponse.json({ error: "Gym name and slug are required" }, { status: 400 });
    }

    const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, "").replace(/--+/g, "-");
    if (cleanSlug.length < 3) {
      return NextResponse.json({ error: "Slug must be at least 3 characters" }, { status: 400 });
    }

    const existing = await prisma.gym.findUnique({ where: { slug: cleanSlug } });
    if (existing) {
      return NextResponse.json({ error: "This URL slug is already taken" }, { status: 409 });
    }

    const gym = await prisma.gym.create({
      data: {
        clerkOrgId: `local-${cleanSlug}`,
        name: gymName,
        slug: cleanSlug,
        timezone: timezone || "America/Chicago",
      },
    });

    return NextResponse.json({
      success: true,
      gym: { id: gym.id, slug: gym.slug },
    }, { status: 201 });
  } catch (error) {
    console.error("Onboarding error:", error);
    return NextResponse.json({ error: "Failed to create gym" }, { status: 500 });
  }
}
