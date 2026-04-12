export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/local-auth";
import { prisma } from "@/lib/prisma";
import { Resend } from "resend";

const PLATFORM_ADMINS = (process.env.PLATFORM_ADMIN_EMAILS || "matflow@craftedsystems.io")
  .split(",")
  .map((e) => e.trim().toLowerCase());

import { signTrackingParams } from "@/lib/tracking-sig";

const FROM = "MatFlow <noreply@mymatflow.com>";
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.mymatflow.com";

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
  if (audience === "database_leads_unsent") {
    const allSent = await prisma.campaignEvent.findMany({
      where: { event: "sent" },
      select: { email: true },
      distinct: ["email"],
    });
    const sentSet = new Set(allSent.map(e => e.email));
    const leads = await prisma.gymDatabase.findMany({
      where: { email: { not: null } },
      select: { email: true },
    });
    return leads.map(l => l.email).filter((e): e is string => !!e && !sentSet.has(e));
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

function injectTracking(html: string, campaignId: string, email: string): string {
  const encodedEmail = encodeURIComponent(email);

  // Add tracking pixel with HMAC signature
  const openSig = signTrackingParams({ cid: campaignId, e: encodedEmail });
  const pixelUrl = `${BASE_URL}/api/track/open?cid=${campaignId}&e=${encodedEmail}&t=${Date.now()}&sig=${openSig}`;
  const pixel = `<img src="${pixelUrl}" width="1" height="1" alt="" style="border:0;width:1px;height:1px;" />`;

  // Add unsubscribe link before </body>
  const unsubSig = signTrackingParams({ e: encodedEmail });
  const unsubUrl = `${BASE_URL}/api/unsubscribe?e=${encodedEmail}&sig=${unsubSig}`;
  const unsubFooter = `<table width="100%" cellpadding="0" cellspacing="0" style="background:#000000;padding:16px;"><tr><td align="center"><div style="font-size:11px;color:#525252;text-align:center;">You received this because your gym is listed on Google. <a href="${unsubUrl}" style="color:#525252;text-decoration:underline;">Unsubscribe</a></div></td></tr></table>`;

  let tracked = html.replace(/<\/body>/i, `${unsubFooter}${pixel}</body>`);

  // Wrap <a href="..."> links with click tracker (skip mailto: and #)
  tracked = tracked.replace(
    /(<a\s[^>]*href=")([^"#][^"]*?)("[^>]*>)/gi,
    (match, before, url, after) => {
      if (url.startsWith("mailto:") || url.startsWith("#") || url.includes("/api/track/")) return match;
      const clickSig = signTrackingParams({ cid: campaignId, e: encodedEmail, url });
      const trackUrl = `${BASE_URL}/api/track/click?cid=${campaignId}&e=${encodedEmail}&url=${encodeURIComponent(url)}&sig=${clickSig}`;
      return `${before}${trackUrl}${after}`;
    }
  );

  return tracked;
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

  // Skip already-sent and unsubscribed emails
  const [alreadySentList, unsubList] = await Promise.all([
    prisma.campaignEvent.findMany({ where: { campaignId: id, event: "sent" }, select: { email: true } }),
    prisma.emailUnsubscribe.findMany({ select: { email: true } }),
  ]);
  const alreadySent = new Set(alreadySentList.map(e => e.email));
  const unsubscribed = new Set(unsubList.map(e => e.email));

  const unsent = testMode ? recipients : recipients.filter(e => !alreadySent.has(e) && !unsubscribed.has(e));
  const skipped = recipients.length - unsent.length;
  const capped = unsent.slice(0, 1000);
  for (const to of capped) {
    try {
      const trackedHtml = injectTracking(campaign.html, id, to);
      const encodedTo = encodeURIComponent(to);
      const listUnsubSig = signTrackingParams({ e: encodedTo });
      const unsubUrl = `${BASE_URL}/api/unsubscribe?e=${encodedTo}&sig=${listUnsubSig}`;
      await resend.emails.send({
        from: FROM,
        replyTo: "franklujan@gmail.com",
        to,
        subject: campaign.subject,
        html: trackedHtml,
        headers: {
          "List-Unsubscribe": `<${unsubUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      });
      sent++;

      // Log sent event
      await prisma.campaignEvent.create({
        data: { campaignId: id, email: to, event: "sent" },
      }).catch(() => {});
    } catch (err) {
      errors.push(`${to}: ${String(err).slice(0, 100)}`);

      // Log bounce/failure
      await prisma.campaignEvent.create({
        data: { campaignId: id, email: to, event: "failed", metadata: String(err).slice(0, 200) },
      }).catch(() => {});
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

  return NextResponse.json({ success: true, sent, skipped, total: capped.length, errors: errors.slice(0, 5) });
}
