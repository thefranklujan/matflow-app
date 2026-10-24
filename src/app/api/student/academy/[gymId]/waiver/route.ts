export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireStudentMembershipForGym } from "@/lib/student-membership";
import { signCurrentWaiver, waiverStatusFor, WaiverError } from "@/lib/waiver";
import { logActivity } from "@/lib/activity-log";

type Params = { params: Promise<{ gymId: string }> };

// Student view of ONE academy's current waiver. Authorization: authenticated
// student + active, approved membership in that gym (re-checked per request).
export async function GET(_req: NextRequest, { params }: Params) {
  const { gymId } = await params;
  const auth = await requireStudentMembershipForGym(gymId);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  return NextResponse.json(await waiverStatusFor(gymId, auth.member.id), {
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { gymId } = await params;
  const auth = await requireStudentMembershipForGym(gymId);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json().catch(() => ({}));
  try {
    const result = await signCurrentWaiver({
      gymId,
      memberId: auth.member.id,
      templateId: body.templateId,
      version: body.version,
      signedName: body.signedName,
    });
    if (!result.alreadySigned) {
      logActivity({ gymId, action: "waiver_signed", actorId: auth.member.id, actorName: String(body.signedName).trim(), targetId: body.templateId, meta: { version: result.version } });
    }
    return NextResponse.json({ success: true, ...result }, { status: result.alreadySigned ? 200 : 201 });
  } catch (err) {
    if (err instanceof WaiverError) {
      const current = err.status === 409 ? await waiverStatusFor(gymId, auth.member.id).catch(() => null) : null;
      return NextResponse.json({ error: err.message, code: err.code, current }, { status: err.status });
    }
    return NextResponse.json({ error: "Failed to sign waiver" }, { status: 500 });
  }
}
