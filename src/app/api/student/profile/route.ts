export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/local-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session?.studentId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const student = await prisma.student.findUnique({
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
  });
  return NextResponse.json({
    profile: student
      ? {
          ...student,
          trainingSince: student.trainingSince ? student.trainingSince.toISOString().slice(0, 10) : null,
        }
      : null,
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
