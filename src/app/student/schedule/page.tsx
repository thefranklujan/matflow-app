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

  // Friends = students in any of:
  //  (a) the same GymGroups as me, or
  //  (b) active Members at the same gyms as me
  const [myGroups, myMemberships] = await Promise.all([
    prisma.gymGroupMember.findMany({
      where: { studentId, status: "active" },
      select: { groupId: true },
    }),
    prisma.member.findMany({
      where: { studentId, active: true, approved: true },
      select: { gymId: true },
    }),
  ]);
  const groupIds = myGroups.map((g) => g.groupId);
  const gymIds = Array.from(new Set(myMemberships.map((m) => m.gymId)));

  const [groupFriendIds, gymFriendIds] = await Promise.all([
    groupIds.length
      ? prisma.gymGroupMember
          .findMany({
            where: { groupId: { in: groupIds }, status: "active", NOT: { studentId } },
            select: { studentId: true },
          })
          .then((r) => r.map((m) => m.studentId))
      : Promise.resolve([] as string[]),
    gymIds.length
      ? prisma.member
          .findMany({
            where: {
              gymId: { in: gymIds },
              active: true,
              approved: true,
              studentId: { not: null, notIn: [studentId] },
            },
            select: { studentId: true },
          })
          .then((r) => r.map((m) => m.studentId).filter((id): id is string => !!id))
      : Promise.resolve([] as string[]),
  ]);
  const friendIds = Array.from(new Set([...groupFriendIds, ...gymFriendIds]));

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
