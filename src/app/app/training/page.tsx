export const dynamic = "force-dynamic";

import { requireMember } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import TrainingLogClient from "../../student/training/TrainingLogClient";

export default async function MemberTrainingLogPage() {
  const { memberId } = await requireMember();
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: { studentId: true },
  });
  if (!member?.studentId) redirect("/app");

  const sessions = await prisma.trainingSession.findMany({
    where: { studentId: member.studentId },
    orderBy: { date: "desc" },
    take: 200,
  });

  return (
    <TrainingLogClient
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
