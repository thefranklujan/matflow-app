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

  // Aggregate per email using raw SQL for speed
  const rows: { email: string; sent: number; opened: boolean; clicked: boolean; last_event: string; last_time: Date }[] = await prisma.$queryRaw`
    SELECT
      email,
      COUNT(*) FILTER (WHERE event = 'sent') as sent,
      bool_or(event = 'open') as opened,
      bool_or(event = 'click') as clicked,
      (array_agg(event ORDER BY "createdAt" DESC))[1] as last_event,
      MAX("createdAt") as last_time
    FROM "CampaignEvent"
    GROUP BY email
    ORDER BY email
  `;

  // Get gym info for these emails
  const emails = rows.map(r => r.email);
  const gyms = await prisma.gymDatabase.findMany({
    where: { email: { in: emails } },
    select: { email: true, name: true, state: true },
  });
  const gymMap: Record<string, { name: string; state: string | null }> = {};
  for (const g of gyms) {
    if (g.email) gymMap[g.email] = { name: g.name, state: g.state };
  }

  // Get unsubscribed
  const unsubs = await prisma.emailUnsubscribe.findMany({ select: { email: true } });
  const unsubSet = new Set(unsubs.map(u => u.email));

  const recipients = rows.map(r => ({
    email: r.email,
    sent: Number(r.sent),
    opened: r.opened,
    clicked: r.clicked,
    lastEvent: r.last_event,
    lastEventTime: r.last_time,
    gymName: gymMap[r.email]?.name || null,
    state: gymMap[r.email]?.state || null,
    unsubscribed: unsubSet.has(r.email),
  }));

  const totalSent = recipients.length;
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
