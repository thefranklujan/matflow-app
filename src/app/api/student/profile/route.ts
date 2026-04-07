export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/local-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session?.studentId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const student = await prisma.student.findUnique({
    where: { id: session.studentId },
    select: { firstName: true, lastName: true, email: true, phone: true },
  });
  return NextResponse.json({ profile: student });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session?.studentId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { firstName, lastName, phone } = await req.json();
  await prisma.student.update({
    where: { id: session.studentId },
    data: { firstName, lastName, phone: phone || null },
  });
  return NextResponse.json({ success: true });
}
