export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendTrialExpiring } from "@/lib/email";
import { findGymOwner } from "@/lib/gym-owner";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  // An unset CRON_SECRET must refuse, not match the literal "Bearer undefined".
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
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
    select: { id: true, trialEndsAt: true },
  });

  let sent = 0;
  for (const gym of expiringGyms) {
    // The owner by registration marker, not the oldest row.
    const admin = await findGymOwner(gym.id, { email: true, firstName: true, lastName: true });
    if (!admin) continue;

    const daysLeft = Math.ceil((gym.trialEndsAt!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    // Awaited: an un-awaited send can be dropped when the function freezes.
    await sendTrialExpiring(admin.email, `${admin.firstName} ${admin.lastName}`, daysLeft);
    sent++;
  }

  return NextResponse.json({ sent, checked: expiringGyms.length });
}
