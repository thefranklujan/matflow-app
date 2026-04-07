export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSession } from "@/lib/local-auth";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ authenticated: false });
  }

  // Apply view-as-student downgrade for client (so sidebar hides admin items)
  const c = await cookies();
  const viewAsStudent = c.get("view_as_student")?.value === "1";
  if (viewAsStudent && session.role === "admin") {
    session.role = "member";
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
