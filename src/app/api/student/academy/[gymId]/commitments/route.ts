export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStudentMembershipForGym } from "@/lib/student-membership";
import { CommitmentError, occurrenceIdentity } from "@/lib/class-commitment";

type Params = { params: Promise<{ gymId: string }> };

/**
 * Student "I'm going" for one dated academy class occurrence. Intent only:
 * this never records attendance. Authorization: authenticated student with an
 * active, approved membership in this gym; the class must be an active
 * schedule of THIS gym and an upcoming occurrence (src/lib/class-commitment.ts).
 */
async function resolve(
  req: NextRequest,
  gymId: string,
): Promise<{ error: NextResponse } | { memberId: string; identity: ReturnType<typeof occurrenceIdentity> }> {
  const auth = await requireStudentMembershipForGym(gymId);
  if (!auth.ok) return { error: NextResponse.json({ error: auth.error }, { status: auth.status }) };
  const body = await req.json().catch(() => ({}));
  const [slot, gym] = await Promise.all([
    typeof body.scheduleId === "string"
      ? prisma.classSchedule.findFirst({ where: { id: body.scheduleId, gymId, active: true } })
      : null,
    prisma.gym.findUnique({ where: { id: gymId }, select: { timezone: true } }),
  ]);
  try {
    const identity = occurrenceIdentity(slot, body.date, new Date(), gym?.timezone || "America/Chicago");
    return { memberId: auth.member.id, identity };
  } catch (err) {
    if (err instanceof CommitmentError) {
      return { error: NextResponse.json({ error: err.message, code: err.code }, { status: 400 }) };
    }
    throw err;
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const { gymId } = await params;
  const r = await resolve(req, gymId);
  if ("error" in r) return r.error;
  await prisma.scheduleCommitment.upsert({
    where: {
      gymId_memberId_classDate_classType: {
        gymId,
        memberId: r.memberId,
        classDate: r.identity.classDate,
        classType: r.identity.classType,
      },
    },
    update: { locationSlug: r.identity.locationSlug },
    create: { gymId, memberId: r.memberId, ...r.identity },
  });
  return NextResponse.json({ committed: true }, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { gymId } = await params;
  const r = await resolve(req, gymId);
  if ("error" in r) return r.error;
  await prisma.scheduleCommitment.deleteMany({
    where: { gymId, memberId: r.memberId, classDate: r.identity.classDate, classType: r.identity.classType },
  });
  return NextResponse.json({ committed: false });
}
