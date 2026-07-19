import { NextRequest, NextResponse } from "next/server";
import { requireOwnerAccess, entitlementErrorBody } from "@/lib/owner-access";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const { gymId } = await requireOwnerAccess();

    const videos = await prisma.video.findMany({
      where: { gymId },
      orderBy: { classDate: "desc" },
    });

    return NextResponse.json(videos);
  } catch (err) {
    const entitlement = entitlementErrorBody(err);
    if (entitlement) return NextResponse.json(entitlement, { status: 402 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { gymId } = await requireOwnerAccess();

    const body = await req.json();
    const { title, embedUrl, description, classType, classDate, published } = body;

    if (!title || !embedUrl || !classType || !classDate) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const video = await prisma.video.create({
      data: {
        title,
        embedUrl,
        description: description || null,
        classType,
        classDate: new Date(classDate),
        published: published !== false,
        gymId,
      },
    });

    return NextResponse.json(video, { status: 201 });
  } catch (err) {
    const entitlement = entitlementErrorBody(err);
    if (entitlement) return NextResponse.json(entitlement, { status: 402 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
