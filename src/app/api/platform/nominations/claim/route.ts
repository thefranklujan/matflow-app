export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/local-auth";
import { prisma } from "@/lib/prisma";

const PLATFORM_ADMINS = (
  process.env.PLATFORM_ADMIN_EMAILS || "matflow@craftedsystems.io,franklujan@gmail.com"
)
  .split(",")
  .map((e) => e.trim().toLowerCase());

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !PLATFORM_ADMINS.includes(session.email.trim().toLowerCase())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const groupName: string = (body.groupName || "").trim();
  const targetGymId: string = (body.targetGymId || "").trim();

  if (!groupName || !targetGymId) {
    return NextResponse.json(
      { error: "groupName and targetGymId are required" },
      { status: 400 }
    );
  }

  const gym = await prisma.gym.findUnique({ where: { id: targetGymId } });
  if (!gym) {
    return NextResponse.json({ error: "Target gym not found" }, { status: 404 });
  }

  const nominations = await prisma.gymNomination.findMany({
    where: { gymName: { equals: groupName, mode: "insensitive" } },
  });

  if (nominations.length === 0) {
    return NextResponse.json(
      { error: "No nominations found with that name" },
      { status: 404 }
    );
  }

  let joinRequestsCreated = 0;
  for (const n of nominations) {
    // Skip if the student is already a member of this gym
    const existingMember = await prisma.member.findFirst({
      where: { gymId: gym.id, studentId: n.studentId },
    });
    if (existingMember) continue;

    // Upsert the join request so re-claims don't error
    const existingReq = await prisma.joinRequest.findUnique({
      where: { studentId_gymId: { studentId: n.studentId, gymId: gym.id } },
    });
    if (existingReq) {
      if (existingReq.status === "rejected") {
        await prisma.joinRequest.update({
          where: { id: existingReq.id },
          data: { status: "pending", message: `Auto-created from nomination: ${groupName}` },
        });
        joinRequestsCreated++;
      }
    } else {
      await prisma.joinRequest.create({
        data: {
          studentId: n.studentId,
          gymId: gym.id,
          status: "pending",
          message: `Auto-created from nomination: ${groupName}`,
        },
      });
      joinRequestsCreated++;
    }
  }

  // Mark nominations as claimed so they're hidden from the nominations page.
  await prisma.gymNomination.updateMany({
    where: { gymName: { equals: groupName, mode: "insensitive" } },
    data: { status: "claimed" },
  });

  // Drop the GymGroup(s) tied to this name so the "NOT ACTIVE" cards disappear
  // from /student/gyms. Cascades remove any group memberships/posts.
  await prisma.gymGroup.deleteMany({
    where: { name: { equals: groupName, mode: "insensitive" } },
  });

  return NextResponse.json({
    success: true,
    joinRequestsCreated,
    claimedNominations: nominations.length,
    targetGymName: gym.name,
  });
}
