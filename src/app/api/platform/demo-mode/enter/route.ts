export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSession } from "@/lib/local-auth";
import { getPlatformAdminSession } from "@/lib/platform-admin";
import { prisma } from "@/lib/prisma";
import { findGymOwner } from "@/lib/gym-owner";

const DEMO_GYM_ID = "platform-admin-gym";

export async function POST() {
  const session = await getPlatformAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Display-only flag for the banner. Who to restore on exit travels inside
  // the signed session (impersonatorId), never in a cookie.
  const c = await cookies();
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

  const owner = gym ? await findGymOwner(gym.id) : null;
  if (!gym || !owner) {
    return NextResponse.json({ error: "Demo gym not found" }, { status: 404 });
  }

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
