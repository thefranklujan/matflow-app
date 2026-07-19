import { NextRequest, NextResponse } from "next/server";
import { requireOwnerAccess, entitlementErrorBody } from "@/lib/owner-access";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";
import { notify } from "@/lib/push";
import { sendAnnouncementEmail } from "@/lib/email";
import { signTrackingParams } from "@/lib/tracking-sig";

const APP_ORIGIN = "https://app.mymatflow.com";
const EMAIL_RECIPIENT_CAP = 1000;
const TEST_EMAIL = "franklujan@gmail.com";

export async function GET() {
  try {
    const { gymId } = await requireOwnerAccess();

    const announcements = await prisma.announcement.findMany({
      where: { gymId },
      orderBy: [{ pinned: "desc" }, { publishedAt: "desc" }],
    });

    return NextResponse.json(announcements);
  } catch (err) {
    const entitlement = entitlementErrorBody(err);
    if (entitlement) return NextResponse.json(entitlement, { status: 402 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

function unsubUrl(email: string) {
  const sig = signTrackingParams({ e: email });
  return `${APP_ORIGIN}/api/unsubscribe?e=${encodeURIComponent(email)}&sig=${sig}`;
}

export async function POST(req: NextRequest) {
  let gymId: string;
  try {
    ({ gymId } = await requireOwnerAccess());
  } catch (err) {
    const entitlement = entitlementErrorBody(err);
    if (entitlement) return NextResponse.json(entitlement, { status: 402 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { title, content, pinned } = body;
    // channels.email opts the announcement into email; in-app + push are always on.
    const emailChannel = !!body.channels?.email;
    const emailTest = !!body.emailTest;
    const audience: string = body.audience || "all"; // "all" | <beltRank>

    if (!title || !content) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const announcement = await prisma.announcement.create({
      data: {
        title,
        content,
        pinned: pinned || false,
        gymId,
      },
    });

    logActivity({ gymId, action: "announcement_created", actorName: "Admin", targetId: announcement.id, targetName: title });

    // In-app inbox + push (existing behavior, always runs).
    const gym = await prisma.gym.findUnique({ where: { id: gymId }, select: { name: true } });
    const members = await prisma.member.findMany({
      where: { gymId, active: true, approved: true, studentId: { not: null } },
      select: { studentId: true },
    });
    const externalIds = members
      .map((m) => (m.studentId ? `student-${m.studentId}` : null))
      .filter((x): x is string => Boolean(x));
    notify({
      externalIds,
      kind: "announcement",
      title: gym?.name ? `${gym.name}: ${title}` : title,
      body: content.length > 140 ? content.slice(0, 137) + "..." : content,
      url: "/student?tab=announcements",
      gymId,
    });

    // Optional email channel.
    let emailResult: { sent: number; failed: number; skipped: number; total: number } | null = null;
    if (emailChannel) {
      emailResult = await dispatchEmails({
        announcementId: announcement.id,
        gymId,
        gymName: gym?.name || "Your gym",
        title,
        content,
        audience,
        emailTest,
      });
    }

    return NextResponse.json({ ...announcement, email: emailResult }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create announcement" }, { status: 500 });
  }
}

async function dispatchEmails(args: {
  announcementId: string;
  gymId: string;
  gymName: string;
  title: string;
  content: string;
  audience: string;
  emailTest: boolean;
}) {
  const { announcementId, gymId, gymName, title, content, audience, emailTest } = args;

  // Test mode sends only to Frank, never the real roster.
  let emails: string[];
  if (emailTest) {
    emails = [TEST_EMAIL];
  } else {
    const where: { gymId: string; active: boolean; approved: boolean; beltRank?: string } = {
      gymId,
      active: true,
      approved: true,
    };
    if (audience !== "all") where.beltRank = audience;
    const members = await prisma.member.findMany({ where, select: { email: true } });
    emails = Array.from(new Set(members.map((m) => m.email.trim().toLowerCase()).filter(Boolean)));

    // Respect global unsubscribes, and record each skip so the owner can see it.
    if (emails.length > 0) {
      const unsubs = await prisma.emailUnsubscribe.findMany({
        where: { email: { in: emails } },
        select: { email: true },
      });
      const unsubSet = new Set(unsubs.map((u) => u.email));
      for (const e of emails.filter((x) => unsubSet.has(x))) {
        await prisma.announcementDelivery.create({
          data: { announcementId, email: e, channel: "email", status: "skipped_unsubscribed" },
        });
      }
      emails = emails.filter((e) => !unsubSet.has(e));
    }
  }

  emails = emails.slice(0, EMAIL_RECIPIENT_CAP);

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  for (const email of emails) {
    const result = await sendAnnouncementEmail(email, {
      gymName,
      title,
      content,
      unsubUrl: emailTest ? undefined : unsubUrl(email),
    });
    let status: string;
    if (result.ok) {
      status = "sent";
      sent++;
    } else if (result.skipped) {
      // No RESEND_API_KEY configured (local/dev) — nothing actually sent.
      status = "skipped_no_provider";
      skipped++;
    } else {
      status = "failed";
      failed++;
    }
    await prisma.announcementDelivery.create({
      data: { announcementId, email, channel: "email", status, error: result.error || null },
    });
  }

  // Only stamp emailSentAt when something actually went out.
  if (sent > 0) {
    await prisma.announcement.update({
      where: { id: announcementId },
      data: { emailSentAt: new Date(), emailSentCount: sent },
    });
  }

  return { sent, failed, skipped, total: emails.length };
}
