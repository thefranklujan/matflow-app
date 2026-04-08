export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/local-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session?.studentId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [student, myNominations, allGroups, activeGyms] = await Promise.all([
    prisma.student.findUnique({
      where: { id: session.studentId },
      select: {
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        homeGym: true,
        beltRank: true,
        stripes: true,
        trainingSince: true,
      },
    }),
    prisma.gymNomination.findMany({
      where: { studentId: session.studentId },
      select: { gymName: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.gymGroup.findMany({
      select: { name: true, memberCount: true },
      orderBy: [{ memberCount: "desc" }, { name: "asc" }],
      take: 200,
    }),
    prisma.gym.findMany({
      where: {
        id: { notIn: ["platform-owner-gym", "platform-admin-gym"] },
        subscriptionStatus: { not: "cancelled" },
      },
      select: { name: true },
      orderBy: { name: "asc" },
      take: 200,
    }),
  ]);

  // Build a deduped list: every active gym + every nominated gym group
  const seen = new Set<string>();
  const gymOptions: string[] = [];
  for (const g of activeGyms) {
    const key = g.name.trim();
    if (!seen.has(key.toLowerCase())) {
      seen.add(key.toLowerCase());
      gymOptions.push(key);
    }
  }
  for (const g of allGroups) {
    const key = g.name.trim();
    if (!seen.has(key.toLowerCase())) {
      seen.add(key.toLowerCase());
      gymOptions.push(key);
    }
  }

  // Default to most recent nomination if homeGym is empty
  const defaultedHomeGym = student?.homeGym || myNominations[0]?.gymName || null;

  return NextResponse.json({
    profile: student
      ? {
          ...student,
          homeGym: defaultedHomeGym,
          trainingSince: student.trainingSince ? student.trainingSince.toISOString().slice(0, 10) : null,
        }
      : null,
    gymOptions,
  });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session?.studentId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { firstName, lastName, phone, homeGym, beltRank, stripes, trainingSince } = await req.json();
  await prisma.student.update({
    where: { id: session.studentId },
    data: {
      firstName,
      lastName,
      phone: phone || null,
      homeGym: homeGym || null,
      beltRank: beltRank || "white",
      stripes: typeof stripes === "number" ? stripes : 0,
      trainingSince: trainingSince ? new Date(trainingSince) : null,
    },
  });
  return NextResponse.json({ success: true });
}
