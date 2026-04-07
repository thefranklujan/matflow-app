export const dynamic = "force-dynamic";

import { getSession } from "@/lib/local-auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import TrainingPlanClient from "./TrainingPlanClient";

export default async function StudentSchedulePage() {
  const session = await getSession();
  if (!session?.studentId) redirect("/sign-in");

  const plans = await prisma.studentTrainingPlan.findMany({
    where: { studentId: session.studentId },
    orderBy: { date: "asc" },
  });

  return (
    <TrainingPlanClient
      initialDates={plans.map((p) => p.date.toISOString().slice(0, 10))}
    />
  );
}
