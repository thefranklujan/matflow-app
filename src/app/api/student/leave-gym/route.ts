export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSession } from "@/lib/local-auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = await getSession();
  if (!session?.memberId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Delete the member record so the underlying Student is no longer affiliated
  await prisma.member.delete({ where: { id: session.memberId } }).catch(() => null);

  // Clear session. they need to sign in again
  const c = await cookies();
  c.delete("matflow-session");
  return NextResponse.json({ success: true });
}
