import { requireMember } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ScheduleClient from "./ScheduleClient";

export const dynamic = "force-dynamic";

export default async function SchedulePage() {
  const { gymId, memberId, orgRole } = await requireMember();
  const isAdmin = orgRole === "org:admin";

  const [schedule, commitments] = await Promise.all([
    prisma.classSchedule.findMany({
      where: { gymId, active: true },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    }),
    memberId
      ? prisma.scheduleCommitment.findMany({
          where: { gymId, memberId },
          orderBy: { classDate: "asc" },
        })
      : Promise.resolve([]),
  ]);

  return (
    <ScheduleClient
      isAdmin={isAdmin}
      schedule={schedule.map((s) => ({
        id: s.id,
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
        classType: s.classType,
        instructor: s.instructor,
        topic: s.topic,
        locationSlug: s.locationSlug,
      }))}
      initialCommitments={commitments.map((c) => ({
        id: c.id,
        classDate: c.classDate.toISOString(),
        classType: c.classType,
        locationSlug: c.locationSlug,
      }))}
    />
  );
}
