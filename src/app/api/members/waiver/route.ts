export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireMember } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";

// GET: Get active waiver template + member's signature status
export async function GET() {
  try {
    const { gymId, memberId } = await requireMember();

    const template = await prisma.waiverTemplate.findFirst({
      where: { gymId, active: true },
    });

    if (!template) {
      return NextResponse.json({ template: null, signed: false });
    }

    const signature = await prisma.waiverSignature.findFirst({
      where: { memberId, templateId: template.id },
    });

    return NextResponse.json({
      template: { id: template.id, title: template.title, content: template.content },
      signed: !!signature,
      signedAt: signature?.signedAt || null,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

// POST: Sign the waiver
export async function POST(request: NextRequest) {
  try {
    const { gymId, memberId } = await requireMember();
    const { templateId, signedName } = await request.json();

    if (!templateId || !signedName) {
      return NextResponse.json({ error: "Template ID and signed name required" }, { status: 400 });
    }

    const template = await prisma.waiverTemplate.findFirst({
      where: { id: templateId, gymId },
    });
    if (!template) {
      return NextResponse.json({ error: "Waiver not found" }, { status: 404 });
    }

    // Check if already signed
    const existing = await prisma.waiverSignature.findFirst({
      where: { memberId, templateId },
    });
    if (existing) {
      return NextResponse.json({ error: "Already signed" }, { status: 400 });
    }

    const signature = await prisma.waiverSignature.create({
      data: {
        gymId,
        memberId,
        templateId,
        signedName,
        waiverContentSnapshot: template.content,
      },
    });

    logActivity({ gymId, action: "waiver_signed", actorId: memberId, actorName: signedName, targetId: templateId, targetName: template.title });

    return NextResponse.json({ success: true, signedAt: signature.signedAt }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to sign waiver" }, { status: 500 });
  }
}
