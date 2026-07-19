import { NextRequest, NextResponse } from "next/server";
import { requireOwnerAccess, entitlementErrorBody } from "@/lib/owner-access";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { gymId } = await requireOwnerAccess();

    const { id } = await params;
    const body = await req.json();
    const { title, embedUrl, description, classType, classDate, published } = body;

    // Verify ownership
    const existing = await prisma.video.findFirst({ where: { id, gymId } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const video = await prisma.video.update({
      where: { id },
      data: {
        title,
        embedUrl,
        description: description || null,
        classType,
        classDate: classDate ? new Date(classDate) : undefined,
        published,
      },
    });

    return NextResponse.json(video);
  } catch (err) {
    const entitlement = entitlementErrorBody(err);
    if (entitlement) return NextResponse.json(entitlement, { status: 402 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { gymId } = await requireOwnerAccess();

    const { id } = await params;

    // Verify ownership
    const existing = await prisma.video.findFirst({ where: { id, gymId } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.video.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (err) {
    const entitlement = entitlementErrorBody(err);
    if (entitlement) return NextResponse.json(entitlement, { status: 402 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
