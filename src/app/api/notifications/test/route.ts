export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSession } from "@/lib/local-auth";
import { sendPush } from "@/lib/push";

/**
 * Fires a test push to the currently authenticated user. Used by the
 * "Send me a test notification" button on the notification settings surface.
 */
export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await sendPush({
    externalIds: [session.userId, session.studentId ? `student-${session.studentId}` : ""].filter(
      Boolean
    ),
    title: "MatFlow test",
    body: `Notifications are working for ${session.name}.`,
    url: session.userType === "student" ? "/student" : "/app",
  });

  return NextResponse.json({ success: true });
}
