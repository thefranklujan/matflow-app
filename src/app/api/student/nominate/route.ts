export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/local-auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.studentId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { gymName, city, state, ownerEmail, ownerPhone, notes } = body;
  if (!gymName) return NextResponse.json({ error: "Gym name required" }, { status: 400 });

  const nomination = await prisma.gymNomination.create({
    data: {
      studentId: session.studentId,
      gymName,
      city: city || null,
      state: state || null,
      ownerEmail: ownerEmail || null,
      ownerPhone: ownerPhone || null,
      notes: notes || null,
    },
  });
  return NextResponse.json(nomination, { status: 201 });
}
