export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/local-auth";
import { prisma } from "@/lib/prisma";

const PLATFORM_ADMINS = (process.env.PLATFORM_ADMIN_EMAILS || "matflow@craftedsystems.io")
  .split(",")
  .map((e) => e.trim().toLowerCase());

async function requireAdmin() {
  const session = await getSession();
  if (!session || !PLATFORM_ADMINS.includes(session.email.trim().toLowerCase())) return null;
  return session;
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const campaigns = await prisma.emailCampaign.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, subject: true, audience: true, status: true, sentCount: true, sentAt: true, createdAt: true, createdBy: true },
    take: 100,
  });
  return NextResponse.json({ campaigns });
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { subject, html, audience } = await req.json();
  if (!subject || !html) return NextResponse.json({ error: "Missing subject or html" }, { status: 400 });

  const campaign = await prisma.emailCampaign.create({
    data: {
      subject,
      html,
      audience: audience || "all_students",
      createdBy: session.email,
    },
  });
  return NextResponse.json({ campaign });
}
