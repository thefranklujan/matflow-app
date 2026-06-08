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
      include: { signatures: { select: { id: true, memberId: true, dropInId: true, signedName: true, signedAt: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(templates);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  let gymId: string;
  try {
    ({ gymId } = await requireAdmin());
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { title, content } = await request.json();

    if (!title || !content) {
      return NextResponse.json({ error: "Title and content required" }, { status: 400 });
    }

    // Version is monotonic per gym so signatures can record which version was signed.
    const latest = await prisma.waiverTemplate.findFirst({
      where: { gymId },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const nextVersion = (latest?.version ?? 0) + 1;

    // Only one active waiver at a time.
    await prisma.waiverTemplate.updateMany({
      where: { gymId, active: true },
      data: { active: false },
    });

    const template = await prisma.waiverTemplate.create({
      data: { gymId, title, content, active: true, version: nextVersion },
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
      url: "/members/waiver",
      gymId,
    });

    return NextResponse.json(template, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create waiver" }, { status: 500 });
  }
}

// PUT: edit a template. A material content change bumps the version (a new
// version members must re-sign); editing the title only does not.
export async function PUT(request: NextRequest) {
  let gymId: string;
  try {
    ({ gymId } = await requireAdmin());
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id, title, content } = await request.json();
    if (!id) {
      return NextResponse.json({ error: "Missing waiver id" }, { status: 400 });
    }

    const existing = await prisma.waiverTemplate.findFirst({ where: { id, gymId } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!title || !content) {
      return NextResponse.json({ error: "Title and content required" }, { status: 400 });
    }

    const contentChanged = content !== existing.content;
    const data: { title: string; content: string; version?: number } = { title, content };

    if (contentChanged) {
      const latest = await prisma.waiverTemplate.findFirst({
        where: { gymId },
        orderBy: { version: "desc" },
        select: { version: true },
      });
      data.version = (latest?.version ?? existing.version) + 1;
    }

    const updated = await prisma.waiverTemplate.update({ where: { id }, data });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Failed to update waiver" }, { status: 500 });
  }
}

// DELETE: remove a template. Refuses if signatures exist (they're a legal record);
// owners deactivate those instead.
export async function DELETE(request: NextRequest) {
  let gymId: string;
  try {
    ({ gymId } = await requireAdmin());
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Missing waiver id" }, { status: 400 });
    }

    const existing = await prisma.waiverTemplate.findFirst({
      where: { id, gymId },
      include: { _count: { select: { signatures: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (existing._count.signatures > 0) {
      return NextResponse.json(
        { error: "This waiver has signatures and can't be deleted. Deactivate it instead." },
        { status: 400 }
      );
    }

    await prisma.waiverTemplate.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete waiver" }, { status: 500 });
  }
}
