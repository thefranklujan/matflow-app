export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/local-auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.studentId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const request = await prisma.joinRequest.findFirst({
    where: { id, studentId: session.studentId },
  });
  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (request.status !== "pending") return NextResponse.json({ error: "Cannot withdraw a decided request" }, { status: 400 });

  await prisma.joinRequest.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
