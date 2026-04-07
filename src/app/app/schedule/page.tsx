import { requireMember } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ScheduleClient from "./ScheduleClient";

export const dynamic = "force-dynamic";

export default async function SchedulePage() {
  const { gymId, memberId, orgRole } = await requireMember();
  const isAdmin = orgRole === "org:admin";

  const [schedule, commitments, allCommitments, events, videos] = await Promise.all([
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
    // All commitments across the gym, with member info, for the "who's going" list
    prisma.scheduleCommitment.findMany({
      where: { gymId },
      include: {
        member: { select: { firstName: true, lastName: true, beltRank: true } },
      },
      orderBy: { classDate: "asc" },
    }),
    prisma.event.findMany({
      where: { gymId, active: true },
      orderBy: { date: "asc" },
    }),
    prisma.video.findMany({
      where: { gymId, published: true },
      orderBy: { createdAt: "desc" },
    }),
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
      attendees={allCommitments.map((c) => ({
        classDate: c.classDate.toISOString(),
        classType: c.classType,
        firstName: c.member?.firstName || "",
        lastName: c.member?.lastName || "",
        beltRank: c.member?.beltRank || "white",
      }))}
      videos={videos.map((v) => ({
        id: v.id,
        title: v.title,
        description: v.description,
        embedUrl: v.embedUrl,
        classType: v.classType,
      }))}
      events={events.map((e) => ({
        id: e.id,
        title: e.title,
        description: e.description,
        date: e.date.toISOString(),
        endDate: e.endDate ? e.endDate.toISOString() : null,
        eventType: e.eventType,
      }))}
    />
  );
}
