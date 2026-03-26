import { requireMember } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import MemberShell from "@/components/members/MemberShell";
import CalendarFilters from "./CalendarFilters";
import CalendarGrid from "./CalendarGrid";

export const dynamic = "force-dynamic";

export default async function MemberCalendarPage() {
  const { memberId } = await requireMember();

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

  const [schedule, attendance, events, allAttendance, commitments] =
    await Promise.all([
      prisma.classSchedule.findMany({
        where: { active: true },
        orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
      }),
      memberId
        ? prisma.attendance.findMany({
            where: {
              memberId,
              classDate: { gte: startOfMonth, lte: endOfMonth },
            },
            orderBy: { classDate: "asc" },
          })
        : [],
      prisma.event.findMany({
        where: {
          active: true,
          date: { gte: startOfMonth, lte: endOfMonth },
        },
        orderBy: { date: "asc" },
      }),
      prisma.attendance.findMany({
        where: {
          classDate: { gte: startOfMonth, lte: endOfMonth },
        },
        orderBy: { classDate: "asc" },
        include: {
          member: {
            select: { id: true, firstName: true, lastName: true, beltRank: true },
          },
        },
      }),
      prisma.scheduleCommitment.findMany({
        where: {
          classDate: { gte: startOfMonth, lte: endOfMonth },
        },
        include: {
          member: {
            select: { id: true, firstName: true, lastName: true, beltRank: true },
          },
        },
      }),
    ]);

  return (
    <MemberShell>
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-white uppercase tracking-wider mb-6">
          Calendar
        </h1>
        <CalendarFilters />
        <CalendarGrid
          initialSchedule={JSON.parse(JSON.stringify(schedule))}
          initialAttendance={JSON.parse(JSON.stringify(attendance))}
          initialEvents={JSON.parse(JSON.stringify(events))}
          initialAllAttendance={JSON.parse(JSON.stringify(allAttendance))}
          initialCommitments={JSON.parse(JSON.stringify(commitments))}
          initialMonth={month}
          initialYear={year}
          currentMemberId={memberId}
        />
      </div>
    </MemberShell>
  );
}
