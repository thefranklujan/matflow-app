export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/local-auth";
import { prisma } from "@/lib/prisma";
import { Resend } from "resend";

const PLATFORM_ADMINS = (process.env.PLATFORM_ADMIN_EMAILS || "matflow@craftedsystems.io")
  .split(",")
  .map((e) => e.trim().toLowerCase());

const FROM = "MatFlow <noreply@mymatflow.com>";

async function requireAdmin() {
  const session = await getSession();
  if (!session || !PLATFORM_ADMINS.includes(session.email.trim().toLowerCase())) return null;
  return session;
}

async function resolveRecipients(audience: string, _adminEmail: string): Promise<string[]> {
  if (audience === "test") return ["franklujan@gmail.com"];
  if (audience === "all_students") {
    const students = await prisma.student.findMany({ select: { email: true } });
    return students.map((s) => s.email).filter(Boolean);
  }
  if (audience === "all_admins") {
    const gyms = await prisma.gym.findMany({ select: { id: true } });
    const emails: string[] = [];
    for (const g of gyms) {
      const first = await prisma.member.findFirst({
        where: { gymId: g.id, active: true },
        orderBy: { createdAt: "asc" },
        select: { email: true },
      });
      if (first?.email) emails.push(first.email);
    }
    return emails;
  }
  if (audience.startsWith("database_leads")) {
    const stateMatch = audience.match(/^database_leads_(.+)$/);
    const where: Record<string, unknown> = { email: { not: null } };
    if (stateMatch) where.state = stateMatch[1];
    const leads = await prisma.gymDatabase.findMany({
      where,
      select: { email: true },
    });
    return leads.map((l) => l.email).filter((e): e is string => !!e);
  }
  return [];
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.RESEND_API_KEY) return NextResponse.json({ error: "RESEND_API_KEY not set" }, { status: 500 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const testMode = body.test === true;

  const campaign = await prisma.emailCampaign.findUnique({ where: { id } });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const audience = testMode ? "test" : campaign.audience;
  const recipients = Array.from(new Set(await resolveRecipients(audience, session.email)));
  if (recipients.length === 0) return NextResponse.json({ error: "No recipients" }, { status: 400 });

  const resend = new Resend(process.env.RESEND_API_KEY);
  let sent = 0;
  const errors: string[] = [];

  // Send individually (Resend rate limits via retries handled by SDK). Cap at 500 per call for safety.
  const capped = recipients.slice(0, 500);
  for (const to of capped) {
    try {
      await resend.emails.send({ from: FROM, to, subject: campaign.subject, html: campaign.html });
      sent++;
    } catch (err) {
      errors.push(`${to}: ${String(err).slice(0, 100)}`);
    }
  }

  if (!testMode) {
    await prisma.emailCampaign.update({
      where: { id },
      data: {
        status: "sent",
        sentAt: new Date(),
        sentCount: { increment: sent },
      },
    });
  }

  return NextResponse.json({ success: true, sent, total: capped.length, errors: errors.slice(0, 5) });
}
