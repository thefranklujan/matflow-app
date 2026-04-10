export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/local-auth";
import { prisma } from "@/lib/prisma";

const PLATFORM_ADMINS = (process.env.PLATFORM_ADMIN_EMAILS || "matflow@craftedsystems.io")
  .split(",")
  .map((e) => e.trim().toLowerCase());

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !PLATFORM_ADMINS.includes(session.email.trim().toLowerCase())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const campaign = await prisma.emailCampaign.findUnique({ where: { id } });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const events = await prisma.campaignEvent.findMany({
    where: { campaignId: id },
    orderBy: { createdAt: "desc" },
  });

  const sentEmails = new Set(events.filter(e => e.event === "sent").map(e => e.email));
  const openedEmails = new Set(events.filter(e => e.event === "open").map(e => e.email));
  const clickedEmails = new Set(events.filter(e => e.event === "click").map(e => e.email));
  const failedEmails = new Set(events.filter(e => e.event === "failed").map(e => e.email));

  const totalClicks = events.filter(e => e.event === "click").length;

  // Click breakdown by URL
  const clicksByUrl: Record<string, number> = {};
  for (const e of events.filter(e => e.event === "click" && e.metadata)) {
    const url = e.metadata!;
    clicksByUrl[url] = (clicksByUrl[url] || 0) + 1;
  }

  // Timeline: events grouped by hour
  const timeline: Record<string, { opens: number; clicks: number }> = {};
  for (const e of events) {
    if (e.event !== "open" && e.event !== "click") continue;
    const hour = new Date(e.createdAt).toISOString().slice(0, 13) + ":00";
    if (!timeline[hour]) timeline[hour] = { opens: 0, clicks: 0 };
    if (e.event === "open") timeline[hour].opens++;
    if (e.event === "click") timeline[hour].clicks++;
  }

  // Recent activity
  const recentActivity = events.slice(0, 50).map(e => ({
    email: e.email,
    event: e.event,
    metadata: e.metadata,
    time: e.createdAt,
  }));

  return NextResponse.json({
    campaign: {
      id: campaign.id,
      subject: campaign.subject,
      audience: campaign.audience,
      status: campaign.status,
      sentAt: campaign.sentAt,
      sentCount: campaign.sentCount,
    },
    metrics: {
      sent: sentEmails.size,
      opened: openedEmails.size,
      clicked: clickedEmails.size,
      failed: failedEmails.size,
      totalClicks,
      openRate: sentEmails.size > 0 ? Math.round((openedEmails.size / sentEmails.size) * 100) : 0,
      clickRate: sentEmails.size > 0 ? Math.round((clickedEmails.size / sentEmails.size) * 100) : 0,
      clickToOpenRate: openedEmails.size > 0 ? Math.round((clickedEmails.size / openedEmails.size) * 100) : 0,
    },
    clicksByUrl: Object.entries(clicksByUrl).sort(([, a], [, b]) => b - a),
    timeline: Object.entries(timeline).sort(([a], [b]) => a.localeCompare(b)),
    recentActivity,
    emailLists: {
      sent: Array.from(sentEmails),
      opened: Array.from(openedEmails),
      clicked: Array.from(clickedEmails),
      bounced: Array.from(failedEmails),
    },
  });
}
