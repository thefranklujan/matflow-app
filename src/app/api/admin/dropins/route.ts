import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const { gymId } = await requireAdmin();
    const dropIns = await prisma.dropIn.findMany({
      where: { gymId },
      orderBy: { visitDate: "desc" },
      include: {
        signatures: { select: { id: true, signedAt: true } },
        instructorRef: { select: { name: true } },
      },
    });
    return NextResponse.json(dropIns);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
