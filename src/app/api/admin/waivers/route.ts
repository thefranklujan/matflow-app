export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/push";

export async function GET() {
  try {
    const { gymId } = await requireAdmin();
    const templates = await prisma.waiverTemplate.findMany({
      where: { gymId },
      include: { signatures: { select: { id: true, memberId: true, signedName: true, signedAt: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(templates);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { gymId } = await requireAdmin();
    const { title, content } = await request.json();

    if (!title || !content) {
      return NextResponse.json({ error: "Title and content required" }, { status: 400 });
    }

    // Deactivate existing waivers
    await prisma.waiverTemplate.updateMany({
      where: { gymId, active: true },
      data: { active: false },
    });

    const template = await prisma.waiverTemplate.create({
      data: { gymId, title, content, active: true },
    });

    // Push every active member — they need to re-sign the new waiver.
    const gym = await prisma.gym.findUnique({ where: { id: gymId }, select: { name: true } });
    const members = await prisma.member.findMany({
      where: { gymId, active: true, approved: true, studentId: { not: null } },
      select: { studentId: true },
    });
    const externalIds = members
      .map((m) => (m.studentId ? `student-${m.studentId}` : null))
      .filter((x): x is string => Boolean(x));
    notify({
      externalIds,
      kind: "waiver_required",
      title: `${gym?.name || "Your gym"} needs your signature`,
      body: `New waiver: ${title}. Tap to review and sign.`,
      url: "/student/waiver",
      gymId,
    });

    return NextResponse.json(template, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create waiver" }, { status: 500 });
  }
}
