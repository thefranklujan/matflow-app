export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSession } from "@/lib/local-auth";
import { notify } from "@/lib/push";

/**
 * Fires a test push to the currently authenticated user. Used by the
 * "Send me a test notification" button on the notification settings surface.
 */
export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await notify({
    externalIds: [session.userId, session.studentId ? `student-${session.studentId}` : ""].filter(
      Boolean
    ),
    kind: "test",
    title: "MatFlow test",
    body: `Notifications are working for ${session.name}.`,
    url: session.userType === "student" ? "/student/notifications" : "/app/notifications",
    gymId: session.gymId || undefined,
  });

  return NextResponse.json({ success: true });
}
