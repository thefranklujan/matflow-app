export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSession } from "@/lib/local-auth";
import { prisma } from "@/lib/prisma";
import { isGymOwner } from "@/lib/gym-owner";

export async function POST() {
  const session = await getSession();
  if (!session?.memberId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // The academy owner cannot leave their own academy this way: deleting the
  // owner row would leave the gym without an admin (Codex round 1, finding 1).
  const member = await prisma.member.findUnique({ where: { id: session.memberId }, select: { id: true, gymId: true } });
  if (member && (await isGymOwner(member))) {
    return NextResponse.json({ error: "The academy owner cannot leave their own academy." }, { status: 400 });
  }

  // Delete the member record so the underlying Student is no longer affiliated
  await prisma.member.delete({ where: { id: session.memberId } }).catch(() => null);

  // Clear session. they need to sign in again
  const c = await cookies();
  c.delete("matflow-session");
  return NextResponse.json({ success: true });
}
