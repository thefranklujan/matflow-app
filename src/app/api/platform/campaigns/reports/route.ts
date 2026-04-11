export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSession } from "@/lib/local-auth";
import { prisma } from "@/lib/prisma";

const PLATFORM_ADMINS = (process.env.PLATFORM_ADMIN_EMAILS || "matflow@craftedsystems.io")
  .split(",")
  .map((e) => e.trim().toLowerCase());

export async function GET() {
  const session = await getSession();
  if (!session || !PLATFORM_ADMINS.includes(session.email.trim().toLowerCase())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get all events grouped by email
  const events = await prisma.campaignEvent.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      campaign: { select: { subject: true, audience: true } },
    },
  });

  // Build per-email summary
  const emailMap: Record<string, {
    email: string;
    sent: number;
    opened: boolean;
    clicked: boolean;
    campaigns: string[];
    lastEvent: string;
    lastEventTime: Date;
    state: string | null;
    gymName: string | null;
  }> = {};

  for (const e of events) {
    if (!emailMap[e.email]) {
      emailMap[e.email] = {
        email: e.email,
        sent: 0,
        opened: false,
        clicked: false,
        campaigns: [],
        lastEvent: e.event,
        lastEventTime: e.createdAt,
        state: null,
        gymName: null,
      };
    }
    const rec = emailMap[e.email];
    if (e.event === "sent") rec.sent++;
    if (e.event === "open") rec.opened = true;
    if (e.event === "click") rec.clicked = true;
    const subj = e.campaign?.subject || "";
    if (subj && !rec.campaigns.includes(subj)) rec.campaigns.push(subj);
    if (e.createdAt > rec.lastEventTime) {
      rec.lastEvent = e.event;
      rec.lastEventTime = e.createdAt;
    }
  }

  // Enrich with gym data
  const emails = Object.keys(emailMap);
  const gyms = await prisma.gymDatabase.findMany({
    where: { email: { in: emails } },
    select: { email: true, name: true, state: true },
  });

  for (const g of gyms) {
    if (g.email && emailMap[g.email]) {
      emailMap[g.email].state = g.state;
      emailMap[g.email].gymName = g.name;
    }
  }

  // Get unsubscribed list
  const unsubs = await prisma.emailUnsubscribe.findMany({ select: { email: true } });
  const unsubSet = new Set(unsubs.map(u => u.email));

  const recipients = Object.values(emailMap).map(r => ({
    ...r,
    unsubscribed: unsubSet.has(r.email),
    lastEventTime: r.lastEventTime.toISOString(),
  }));

  // Summary stats
  const totalSent = new Set(recipients.map(r => r.email)).size;
  const totalOpened = recipients.filter(r => r.opened).length;
  const totalClicked = recipients.filter(r => r.clicked).length;
  const totalUnsubscribed = recipients.filter(r => r.unsubscribed).length;

  return NextResponse.json({
    recipients,
    stats: {
      totalSent,
      totalOpened,
      totalClicked,
      totalUnsubscribed,
      openRate: totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0,
      clickRate: totalSent > 0 ? Math.round((totalClicked / totalSent) * 100) : 0,
    },
  });
}
