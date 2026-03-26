export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { gymName, slug, timezone } = body;

    if (!gymName || !slug) {
      return NextResponse.json({ error: "Gym name and slug are required" }, { status: 400 });
    }

    // Validate slug format
    const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, "").replace(/--+/g, "-");
    if (cleanSlug.length < 3) {
      return NextResponse.json({ error: "Slug must be at least 3 characters" }, { status: 400 });
    }

    // Check if slug is taken
    const existing = await prisma.gym.findUnique({ where: { slug: cleanSlug } });
    if (existing) {
      return NextResponse.json({ error: "This URL slug is already taken" }, { status: 409 });
    }

    // Create Clerk organization
    const client = await clerkClient();
    const org = await client.organizations.createOrganization({
      name: gymName,
      createdBy: userId,
    });

    // Create Gym record in database
    const gym = await prisma.gym.create({
      data: {
        clerkOrgId: org.id,
        name: gymName,
        slug: cleanSlug,
        timezone: timezone || "America/Chicago",
      },
    });

    // Create a Member record for the gym owner
    const user = await client.users.getUser(userId);
    await prisma.member.create({
      data: {
        gymId: gym.id,
        clerkUserId: userId,
        email: user.emailAddresses[0]?.emailAddress || "",
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        approved: true,
        active: true,
      },
    });

    return NextResponse.json({
      success: true,
      gym: { id: gym.id, slug: gym.slug },
      orgId: org.id,
    }, { status: 201 });
  } catch (error) {
    console.error("Onboarding error:", error);
    return NextResponse.json({ error: "Failed to create gym" }, { status: 500 });
  }
}
