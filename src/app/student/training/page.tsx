export const dynamic = "force-dynamic";

import { getSession } from "@/lib/local-auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import TrainingLogClient from "./TrainingLogClient";
import { computeStreaks } from "@/lib/streaks";

export default async function TrainingLogPage() {
  const session = await getSession();
  if (!session?.studentId) redirect("/sign-in");

  const sessions = await prisma.trainingSession.findMany({
    where: { studentId: session.studentId },
    orderBy: { date: "desc" },
    take: 500,
  });

  const streaks = computeStreaks(sessions.map((s) => s.date.toISOString()));

  return (
    <TrainingLogClient
      streaks={streaks}
      initialSessions={sessions.map((s) => ({
        id: s.id,
        date: s.date.toISOString(),
        duration: s.duration,
        sessionType: s.sessionType,
        techniques: s.techniques,
        partners: s.partners,
        notes: s.notes,
        rollsWon: s.rollsWon,
        rollsLost: s.rollsLost,
      }))}
    />
  );
}
