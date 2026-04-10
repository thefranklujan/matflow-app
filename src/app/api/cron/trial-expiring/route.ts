export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendTrialExpiring } from "@/lib/email";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const expiringGyms = await prisma.gym.findMany({
    where: {
      subscriptionStatus: "trialing",
      trialEndsAt: {
        gt: now,
        lte: threeDaysFromNow,
      },
    },
    include: {
      members: {
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { email: true, firstName: true, lastName: true },
      },
    },
  });

  let sent = 0;
  for (const gym of expiringGyms) {
    const admin = gym.members[0];
    if (!admin) continue;

    const daysLeft = Math.ceil((gym.trialEndsAt!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    sendTrialExpiring(admin.email, `${admin.firstName} ${admin.lastName}`, daysLeft);
    sent++;
  }

  return NextResponse.json({ sent, checked: expiringGyms.length });
}
