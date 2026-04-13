export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSession } from "@/lib/local-auth";
import { prisma } from "@/lib/prisma";

const PLATFORM_ADMINS = (process.env.PLATFORM_ADMIN_EMAILS || "matflow@craftedsystems.io")
  .split(",")
  .map((e) => e.trim().toLowerCase());

export async function GET() {
  const session = await getSession();
  if (!session || !PLATFORM_ADMINS.includes(session.email.trim().toLowerCase())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const gyms = await prisma.gym.findMany({
    where: { hidden: false },
    select: {
      id: true,
      name: true,
      city: true,
      state: true,
      lat: true,
      lng: true,
      subscriptionStatus: true,
      approved: true,
      _count: { select: { members: true } },
    },
  });

  // Geocode using Google Maps search URL (we don't have lat/lng on Gym model)
  // Return gym info for client-side geocoding via name+city+state
  const pins = gyms.map(g => ({
    id: g.id,
    name: g.name,
    city: g.city,
    state: g.state,
    lat: g.lat,
    lng: g.lng,
    status: g.subscriptionStatus,
    approved: g.approved,
    members: g._count.members,
    query: `${g.name} ${g.city || ""} ${g.state || ""}`.trim(),
  }));

  return NextResponse.json({ pins });
}
