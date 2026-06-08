import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const { gymId } = await requireAdmin();
    const instructors = await prisma.instructor.findMany({
      where: { gymId },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    });
    return NextResponse.json(instructors);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  let gymId: string;
  try {
    ({ gymId } = await requireAdmin());
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const name = (body.name || "").trim();
    if (!name) {
      return NextResponse.json({ error: "Instructor name is required" }, { status: 400 });
    }

    const instructor = await prisma.instructor.create({
      data: {
        gymId,
        name,
        beltRank: body.beltRank || null,
        bio: body.bio?.trim() || null,
      },
    });

    return NextResponse.json(instructor, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create instructor" }, { status: 500 });
  }
}
