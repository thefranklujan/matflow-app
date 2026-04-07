export const dynamic = "force-dynamic";

import { getSession } from "@/lib/local-auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import TrainingPlanClient from "./TrainingPlanClient";

export default async function StudentSchedulePage() {
  const session = await getSession();
  if (!session?.studentId) redirect("/sign-in");
  const studentId = session.studentId;

  const me = await prisma.student.findUnique({
    where: { id: studentId },
    select: { homeGym: true, shareSchedule: true, showFriendsSchedule: true },
  });

  // Friends = students in the same GymGroups as me
  const myGroups = await prisma.gymGroupMember.findMany({
    where: { studentId, status: "active" },
    select: { groupId: true },
  });
  const groupIds = myGroups.map((g) => g.groupId);

  const friendIds = groupIds.length
    ? (
        await prisma.gymGroupMember.findMany({
          where: { groupId: { in: groupIds }, status: "active", NOT: { studentId } },
          select: { studentId: true },
        })
      ).map((m) => m.studentId)
    : [];

  const myGroupsData = groupIds.length
    ? await prisma.gymGroup.findMany({
        where: { id: { in: groupIds } },
        select: { id: true, name: true },
      })
    : [];

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const horizon = new Date(today);
  horizon.setDate(horizon.getDate() + 60);

  const [myPlans, friendPlans] = await Promise.all([
    prisma.studentTrainingPlan.findMany({
      where: { studentId, date: { gte: today } },
      orderBy: { date: "asc" },
    }),
    me?.showFriendsSchedule && friendIds.length
      ? prisma.studentTrainingPlan.findMany({
          where: {
            studentId: { in: friendIds },
            date: { gte: today, lte: horizon },
            student: { shareSchedule: true },
          },
          orderBy: { date: "asc" },
          take: 100,
          include: { student: { select: { firstName: true, lastName: true, beltRank: true } } },
        })
      : Promise.resolve([]),
  ]);

  return (
    <TrainingPlanClient
      shareSchedule={!!me?.shareSchedule}
      showFriendsSchedule={!!me?.showFriendsSchedule}
      myGyms={[
        ...(me?.homeGym ? [{ id: "__home", name: me.homeGym }] : []),
        ...myGroupsData.map((g) => ({ id: g.id, name: g.name })),
      ]}
      initialPlans={myPlans.map((p) => ({
        date: p.date.toISOString().slice(0, 10),
        morning: p.morning,
        noon: p.noon,
        afternoon: p.afternoon,
        gym: p.gym,
      }))}
      friendPlans={friendPlans.map((p) => ({
        date: p.date.toISOString().slice(0, 10),
        morning: p.morning,
        noon: p.noon,
        afternoon: p.afternoon,
        gym: p.gym,
        friendName: p.student ? `${p.student.firstName} ${p.student.lastName}` : "Friend",
        belt: p.student?.beltRank || "white",
      }))}
    />
  );
}
