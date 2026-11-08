export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getPlatformAdminSession } from "@/lib/platform-admin";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await getPlatformAdminSession();
  if (!session) return null;
  return session;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const campaign = await prisma.emailCampaign.findUnique({ where: { id } });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ campaign });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { subject, html, audience } = await req.json();
  const campaign = await prisma.emailCampaign.update({
    where: { id },
    data: {
      ...(subject !== undefined && { subject }),
      ...(html !== undefined && { html }),
      ...(audience !== undefined && { audience }),
    },
  });
  return NextResponse.json({ campaign });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await prisma.emailCampaign.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
