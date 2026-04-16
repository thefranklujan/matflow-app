export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSession, createSession } from "@/lib/local-auth";
import { prisma } from "@/lib/prisma";

const PLATFORM_ADMINS = (
  process.env.PLATFORM_ADMIN_EMAILS || "matflow@craftedsystems.io,franklujan@gmail.com"
)
  .split(",")
  .map((e) => e.trim().toLowerCase());

export async function POST(_req: NextRequest, { params }: { params: Promise<{ gymId: string }> }) {
  const session = await getSession();
  if (!session || !PLATFORM_ADMINS.includes(session.email.trim().toLowerCase())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { gymId } = await params;

  const gym = await prisma.gym.findUnique({
    where: { id: gymId },
    include: { members: { orderBy: { createdAt: "asc" }, take: 1 } },
  });

  if (!gym || gym.members.length === 0) {
    return NextResponse.json({ error: "Gym or owner not found" }, { status: 404 });
  }

  const owner = gym.members[0];

  // Stash the admin's original email so Exit can restore them
  const c = await cookies();
  c.set("view_gym_origin", session.email, { httpOnly: true, path: "/", sameSite: "lax" });
  c.set("view_gym_name", gym.name, { httpOnly: false, path: "/", sameSite: "lax" });
  c.set("viewing_gym", "1", { httpOnly: false, path: "/", sameSite: "lax" });

  await createSession({
    userId: owner.clerkUserId,
    email: owner.email,
    name: `${owner.firstName} ${owner.lastName}`,
    role: "admin",
    gymId: gym.id,
    memberId: owner.id,
  });

  return NextResponse.json({ success: true });
}
