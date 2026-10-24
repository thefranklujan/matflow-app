export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireOwnerAccess, entitlementErrorBody } from "@/lib/owner-access";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/push";
import { editWaiverTemplate, studentWaiverUrl } from "@/lib/waiver";

/**
 * Ask every active student-linked member to review a new waiver version.
 * Records an inbox row and a push attempt per student; acceptance by the push
 * provider is not proof of delivery or of reading. Deep link opens the
 * student academy view of THIS gym's current waiver.
 */
async function notifyWaiverRevision(gymId: string, title: string, revised: boolean) {
  const gym = await prisma.gym.findUnique({ where: { id: gymId }, select: { name: true } });
  const members = await prisma.member.findMany({
    where: { gymId, active: true, approved: true, studentId: { not: null } },
    select: { studentId: true },
  });
  const externalIds = members
    .map((m) => (m.studentId ? `student-${m.studentId}` : null))
    .filter((x): x is string => Boolean(x));
  await notify({
    externalIds,
    kind: "waiver_required",
    title: `${gym?.name || "Your gym"} needs your signature`,
    body: revised ? `Updated waiver: ${title}. Tap to review and sign.` : `New waiver: ${title}. Tap to review and sign.`,
    url: studentWaiverUrl(gymId),
    gymId,
  });
}

export async function GET() {
  try {
    const { gymId } = await requireOwnerAccess();
    const templates = await prisma.waiverTemplate.findMany({
      where: { gymId },
      include: { signatures: { select: { id: true, memberId: true, dropInId: true, signedName: true, signedAt: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(templates);
  } catch (err) {
    const entitlement = entitlementErrorBody(err);
    if (entitlement) return NextResponse.json(entitlement, { status: 402 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  let gymId: string;
  try {
    ({ gymId } = await requireOwnerAccess());
  } catch (err) {
    const entitlement = entitlementErrorBody(err);
    if (entitlement) return NextResponse.json(entitlement, { status: 402 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { title, content } = await request.json();

    if (!title || !content) {
      return NextResponse.json({ error: "Title and content required" }, { status: 400 });
    }

    // Version is monotonic per gym so signatures can record which version was
    // signed. Deactivate + create are one transaction so the gym never has
    // zero or two active waivers mid-replace.
    const template = await prisma.$transaction(async (tx) => {
      const latest = await tx.waiverTemplate.findFirst({
        where: { gymId },
        orderBy: { version: "desc" },
        select: { version: true },
      });
      await tx.waiverTemplate.updateMany({ where: { gymId, active: true }, data: { active: false } });
      return tx.waiverTemplate.create({
        data: { gymId, title, content, active: true, version: (latest?.version ?? 0) + 1 },
      });
    });

    notifyWaiverRevision(gymId, title, false).catch(() => {});

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
    ({ gymId } = await requireOwnerAccess());
  } catch (err) {
    const entitlement = entitlementErrorBody(err);
    if (entitlement) return NextResponse.json(entitlement, { status: 402 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id, title, content } = await request.json();
    if (!id) {
      return NextResponse.json({ error: "Missing waiver id" }, { status: 400 });
    }

    if (!title || !content) {
      return NextResponse.json({ error: "Title and content required" }, { status: 400 });
    }

    // Under the same lock signers take, so a signature can never pair the
    // old snapshot with the new version (or vice versa).
    const edited = await editWaiverTemplate({ gymId, id, title, content });
    if (!edited) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (edited.contentChanged && edited.template.active) {
      notifyWaiverRevision(gymId, title, true).catch(() => {});
    }
    return NextResponse.json(edited.template);
  } catch {
    return NextResponse.json({ error: "Failed to update waiver" }, { status: 500 });
  }
}

// DELETE: remove a template. Refuses if signatures exist (they're a legal record);
// owners deactivate those instead.
export async function DELETE(request: NextRequest) {
  let gymId: string;
  try {
    ({ gymId } = await requireOwnerAccess());
  } catch (err) {
    const entitlement = entitlementErrorBody(err);
    if (entitlement) return NextResponse.json(entitlement, { status: 402 });
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
