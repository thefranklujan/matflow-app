export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/local-auth";
import { prisma } from "@/lib/prisma";

async function effectiveStudentId() {
  const session = await getSession();
  if (!session) return null;
  if (session.studentId) return session.studentId;
  if (session.memberId) {
    const m = await prisma.member.findUnique({ where: { id: session.memberId }, select: { studentId: true } });
    return m?.studentId || null;
  }
  return null;
}

export async function POST(req: NextRequest) {
  const studentId = await effectiveStudentId();
  if (!studentId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { gymName, city, state, ownerEmail, ownerPhone, notes } = body;
  if (!gymName) return NextResponse.json({ error: "Gym name required" }, { status: 400 });

  const nomination = await prisma.gymNomination.create({
    data: {
      studentId,
      gymName,
      city: city || null,
      state: state || null,
      ownerEmail: ownerEmail || null,
      ownerPhone: ownerPhone || null,
      notes: notes || null,
    },
  });

  // Auto-create or join the GymGroup keyed by normalized gym name
  const groupId = gymName.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  await prisma.gymGroup.upsert({
    where: { id: groupId },
    create: { id: groupId, name: gymName, city: city || null, state: state || null },
    update: {},
  });

  // Bootstrap rule: first 3 nominators auto-trusted as active mods.
  // After that, new joiners enter as pending until a mod approves.
  const existingActive = await prisma.gymGroupMember.count({
    where: { groupId, status: "active" },
  });
  const isBootstrap = existingActive < 3;
  await prisma.gymGroupMember.upsert({
    where: { groupId_studentId: { groupId, studentId } },
    create: {
      groupId,
      studentId,
      role: isBootstrap ? "mod" : "member",
      status: isBootstrap ? "active" : "pending",
    },
    update: {},
  });

  // memberCount = active members only
  const count = await prisma.gymGroupMember.count({
    where: { groupId, status: "active" },
  });
  await prisma.gymGroup.update({ where: { id: groupId }, data: { memberCount: count } });

  return NextResponse.json(nomination, { status: 201 });
}
