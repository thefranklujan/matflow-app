export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSession, createSession } from "@/lib/local-auth";
import { prisma } from "@/lib/prisma";

const PLATFORM_ADMINS = (process.env.PLATFORM_ADMIN_EMAILS || "matflow@craftedsystems.io,franklujan@gmail.com")
  .split(",").map(e => e.trim().toLowerCase());

const DEMO_GYM_ID = "platform-admin-gym";

export async function POST() {
  const session = await getSession();
  if (!session || !PLATFORM_ADMINS.includes(session.email.trim().toLowerCase())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Stash original platform-admin email so Exit Demo can restore the session
  const c = await cookies();
  c.set("demo_mode_origin", session.email, { httpOnly: true, path: "/", sameSite: "lax" });
  c.set("demo_mode", "1", { httpOnly: false, path: "/", sameSite: "lax" });

  let gym = await prisma.gym.findUnique({
    where: { id: DEMO_GYM_ID },
    include: { members: { orderBy: { createdAt: "asc" }, take: 1 } },
  });

  // Auto-seed the sample gym if it was deleted or never existed.
  if (!gym) {
    await prisma.gym.create({
      data: {
        id: DEMO_GYM_ID,
        clerkOrgId: DEMO_GYM_ID,
        name: "MatFlow Sample Gym",
        slug: "matflow-sample-gym",
        timezone: "America/Chicago",
        subscriptionStatus: "active",
      },
    });
  }

  gym = await prisma.gym.findUnique({
    where: { id: DEMO_GYM_ID },
    include: { members: { orderBy: { createdAt: "asc" }, take: 1 } },
  });

  if (gym && gym.members.length === 0) {
    await prisma.member.create({
      data: {
        gymId: DEMO_GYM_ID,
        clerkUserId: `demo-owner-${Date.now()}`,
        email: "demo-owner@mymatflow.com",
        firstName: "Demo",
        lastName: "Owner",
        approved: true,
        active: true,
        beltRank: "black",
        stripes: 0,
      },
    });
    gym = await prisma.gym.findUnique({
      where: { id: DEMO_GYM_ID },
      include: { members: { orderBy: { createdAt: "asc" }, take: 1 } },
    });
  }

  if (!gym || gym.members.length === 0) {
    return NextResponse.json({ error: "Demo gym not found" }, { status: 404 });
  }

  const owner = gym.members[0];
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
