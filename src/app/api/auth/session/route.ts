export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSession } from "@/lib/local-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ authenticated: false });
  }

  let gym = null;
  if (session.gymId) {
    const g = await prisma.gym.findUnique({
      where: { id: session.gymId },
      select: { name: true, logo: true },
    });
    if (g) gym = { name: g.name, logo: g.logo };
  }

  const platformAdmins = (process.env.PLATFORM_ADMIN_EMAILS || "matflow@craftedsystems.io")
    .split(",")
    .map(e => e.trim().toLowerCase());
  const isPlatformAdmin = platformAdmins.includes(session.email.trim().toLowerCase());

  return NextResponse.json({ authenticated: true, user: session, gym, isPlatformAdmin });
}
