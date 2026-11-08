export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSession } from "@/lib/local-auth";
import { getPlatformAdminSession } from "@/lib/platform-admin";
import { prisma } from "@/lib/prisma";
import { findGymOwner } from "@/lib/gym-owner";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ gymId: string }> }) {
  const session = await getPlatformAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { gymId } = await params;

  const gym = await prisma.gym.findUnique({ where: { id: gymId } });
  // The owner by registration marker, not the oldest row.
  const owner = gym ? await findGymOwner(gym.id) : null;

  if (!gym || !owner) {
    return NextResponse.json({ error: "Gym or owner not found" }, { status: 404 });
  }

  // Display-only cookies for the "viewing as" banner. Who to restore on exit
  // travels inside the signed session (impersonatorId), never in a cookie.
  const c = await cookies();
  c.set("view_gym_name", gym.name, { httpOnly: false, path: "/", sameSite: "lax" });
  c.set("viewing_gym", "1", { httpOnly: false, path: "/", sameSite: "lax" });

  await createSession({
    userId: owner.clerkUserId,
    email: owner.email,
    name: `${owner.firstName} ${owner.lastName}`,
    role: "admin",
    gymId: gym.id,
    memberId: owner.id,
    userType: "member",
    impersonatorId: session.memberId,
  });

  return NextResponse.json({ success: true });
}
