export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireMember } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";
import { signCurrentWaiver, waiverStatusFor, WaiverError } from "@/lib/waiver";

// GET: the gym's current required waiver + this member's status for its
// CURRENT version (see src/lib/waiver.ts for the contract).
export async function GET() {
  let ctx: { gymId: string; memberId: string };
  try {
    ctx = await requireMember();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await waiverStatusFor(ctx.gymId, ctx.memberId));
  } catch {
    return NextResponse.json({ error: "Failed to load waiver" }, { status: 500 });
  }
}

// POST: sign the version the member was shown. A stale version gets 409 with
// code WAIVER_UPDATED; a repeat of the same version is idempotent.
export async function POST(request: NextRequest) {
  let ctx: { gymId: string; memberId: string };
  try {
    ctx = await requireMember();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const result = await signCurrentWaiver({
      gymId: ctx.gymId,
      memberId: ctx.memberId,
      templateId: body.templateId,
      version: body.version,
      signedName: body.signedName,
    });
    if (!result.alreadySigned) {
      logActivity({ gymId: ctx.gymId, action: "waiver_signed", actorId: ctx.memberId, actorName: String(body.signedName).trim(), targetId: body.templateId, meta: { version: result.version } });
    }
    return NextResponse.json({ success: true, ...result }, { status: result.alreadySigned ? 200 : 201 });
  } catch (err) {
    if (err instanceof WaiverError) {
      const current = err.status === 409 ? await waiverStatusFor(ctx.gymId, ctx.memberId).catch(() => null) : null;
      return NextResponse.json({ error: err.message, code: err.code, current }, { status: err.status });
    }
    return NextResponse.json({ error: "Failed to sign waiver" }, { status: 500 });
  }
}
