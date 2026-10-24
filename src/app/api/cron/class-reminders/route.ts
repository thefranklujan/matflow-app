export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { runClassReminders, REMINDER_WINDOW_MAX, REMINDER_WINDOW_MIN } from "@/lib/class-reminders";

/**
 * /api/cron/class-reminders — Vercel cron, every 5 minutes (vercel.json).
 * Logic, occurrence contract and delivery semantics live in
 * src/lib/class-reminders.ts.
 *
 * Auth: `Authorization: Bearer ${CRON_SECRET}`. An unset CRON_SECRET refuses
 * every request (it previously matched the literal "Bearer undefined").
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runClassReminders(new Date());
  return NextResponse.json({
    success: true,
    ...result,
    windowMinutes: `${REMINDER_WINDOW_MIN}-${REMINDER_WINDOW_MAX}`,
  });
}
