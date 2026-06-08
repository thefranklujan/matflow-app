import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";

export async function GET() {
  try {
    const { gymId } = await requireAdmin();

    const categories = await prisma.category.findMany({
      where: { gymId },
      orderBy: { sortOrder: "asc" },
    });
    return NextResponse.json(categories);
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
      return NextResponse.json({ error: "Category name is required" }, { status: 400 });
    }

    const slug = slugify(name);
    if (!slug) {
      return NextResponse.json({ error: "Category name must contain letters or numbers" }, { status: 400 });
    }

    // Reject duplicates within this gym (matches @@unique([gymId, slug]))
    const existing = await prisma.category.findFirst({ where: { gymId, slug } });
    if (existing) {
      return NextResponse.json({ error: "A category with this name already exists" }, { status: 409 });
    }

    // Append to the end of the list by default.
    const last = await prisma.category.findFirst({
      where: { gymId },
      orderBy: { sortOrder: "desc" },
    });

    const category = await prisma.category.create({
      data: {
        gymId,
        name,
        slug,
        sortOrder: (last?.sortOrder ?? 0) + 1,
      },
    });

    return NextResponse.json(category, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create category" }, { status: 500 });
  }
}
