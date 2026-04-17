import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";
import { sendBulkPush } from "@/lib/push";

export async function GET() {
  try {
    const { gymId } = await requireAdmin();

    const announcements = await prisma.announcement.findMany({
      where: { gymId },
      orderBy: [{ pinned: "desc" }, { publishedAt: "desc" }],
    });

    return NextResponse.json(announcements);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { gymId } = await requireAdmin();

    const body = await req.json();
    const { title, content, pinned } = body;

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

    // Push to every active member whose underlying Student has an OneSignal
    // external_id. We target by student userId so both linked members and
    // gym owners receive the alert.
    const gym = await prisma.gym.findUnique({ where: { id: gymId }, select: { name: true } });
    const members = await prisma.member.findMany({
      where: { gymId, active: true, approved: true, studentId: { not: null } },
      select: { studentId: true },
    });
    const externalIds = members
      .map((m) => (m.studentId ? `student-${m.studentId}` : null))
      .filter((x): x is string => Boolean(x));
    sendBulkPush({
      externalIds,
      title: gym?.name ? `${gym.name}: ${title}` : title,
      body: content.length > 140 ? content.slice(0, 137) + "..." : content,
      url: "/student?tab=announcements",
    });

    return NextResponse.json(announcement, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
