import { requireMember } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import MemberShell from "@/components/members/MemberShell";
import LeaderboardTabs from "./LeaderboardTabs";
import LeaderboardTable from "./LeaderboardTable";
import PeriodToggle from "./PeriodToggle";

export const dynamic = "force-dynamic";

function getISOWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function computeStreaks(
  attendances: { memberId: string; classDate: Date }[]
): Map<string, number> {
  const memberWeeks = new Map<string, Set<string>>();
  for (const a of attendances) {
    const week = getISOWeek(new Date(a.classDate));
    if (!memberWeeks.has(a.memberId)) {
      memberWeeks.set(a.memberId, new Set());
    }
    memberWeeks.get(a.memberId)!.add(week);
  }

  const streaks = new Map<string, number>();
  for (const [memberId, weeks] of memberWeeks) {
    const sorted = [...weeks].sort();
    let longest = 1;
    let current = 1;
    for (let i = 1; i < sorted.length; i++) {
      const [prevYear, prevWeek] = sorted[i - 1].split("-W").map(Number);
      const [curYear, curWeek] = sorted[i].split("-W").map(Number);
      const isConsecutive =
        (curYear === prevYear && curWeek === prevWeek + 1) ||
        (curYear === prevYear + 1 && prevWeek >= 52 && curWeek === 1);
      if (isConsecutive) {
        current++;
        longest = Math.max(longest, current);
      } else {
        current = 1;
      }
    }
    streaks.set(memberId, longest);
  }
  return streaks;
}

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; period?: string }>;
}) {
  const params = await searchParams;
  const { memberId: currentMemberId } = await requireMember();

  const category = params.category || "overall";
  const period = params.period || "month";

  const now = new Date();
  const startDate =
    period === "year"
      ? new Date(now.getFullYear(), 0, 1)
      : new Date(now.getFullYear(), now.getMonth(), 1);
  const endDate = now;

  const dateFilter = { gte: startDate, lte: endDate };

  let entries: {
    rank: number;
    memberId: string;
    name: string;
    beltRank: string;
    value: number;
    label: string;
  }[] = [];

  if (
    category === "overall" ||
    category === "gi" ||
    category === "nogi" ||
    category === "kids"
  ) {
    const classTypeMap: Record<string, string | undefined> = {
      overall: undefined,
      gi: "Gi",
      nogi: "No-Gi",
      kids: "Kids",
    };
    const classTypeFilter = classTypeMap[category];

    const whereClause: Record<string, unknown> = {
      classDate: dateFilter,
    };
    if (classTypeFilter) {
      whereClause.classType = classTypeFilter;
    }

    const grouped = await prisma.attendance.groupBy({
      by: ["memberId"],
      where: whereClause,
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 20,
    });

    if (grouped.length > 0) {
      const memberIds = grouped.map((g) => g.memberId);
      const members = await prisma.member.findMany({
        where: { id: { in: memberIds } },
        select: { id: true, firstName: true, lastName: true, beltRank: true },
      });
      const memberMap = new Map(members.map((m) => [m.id, m]));

      entries = grouped.map((g, i) => {
        const member = memberMap.get(g.memberId);
        return {
          rank: i + 1,
          memberId: g.memberId,
          name: member
            ? `${member.firstName} ${member.lastName}`
            : "Unknown",
          beltRank: member?.beltRank || "white",
          value: g._count.id,
          label: g._count.id === 1 ? "class" : "classes",
        };
      });
    }
  } else if (category === "streaks") {
    const allAttendance = await prisma.attendance.findMany({
      where: { classDate: dateFilter },
      select: { memberId: true, classDate: true },
    });

    const streaks = computeStreaks(allAttendance);
    const sorted = [...streaks.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);

    if (sorted.length > 0) {
      const memberIds = sorted.map(([id]) => id);
      const members = await prisma.member.findMany({
        where: { id: { in: memberIds } },
        select: { id: true, firstName: true, lastName: true, beltRank: true },
      });
      const memberMap = new Map(members.map((m) => [m.id, m]));

      entries = sorted.map(([memberId, streak], i) => {
        const member = memberMap.get(memberId);
        return {
          rank: i + 1,
          memberId,
          name: member
            ? `${member.firstName} ${member.lastName}`
            : "Unknown",
          beltRank: member?.beltRank || "white",
          value: streak,
          label: streak === 1 ? "week" : "weeks",
        };
      });
    }
  } else if (category === "competitions") {
    const results = await prisma.competitionResult.findMany({
      where: { date: dateFilter },
      select: { memberId: true, placement: true },
    });

    const pointMap: Record<string, number> = {
      gold: 4,
      silver: 3,
      bronze: 2,
      participant: 1,
    };

    const memberPoints = new Map<string, number>();
    const memberMedals = new Map<string, number>();
    for (const r of results) {
      const pts = pointMap[r.placement] || 0;
      memberPoints.set(r.memberId, (memberPoints.get(r.memberId) || 0) + pts);
      memberMedals.set(
        r.memberId,
        (memberMedals.get(r.memberId) || 0) + 1
      );
    }

    const sorted = [...memberPoints.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);

    if (sorted.length > 0) {
      const memberIds = sorted.map(([id]) => id);
      const members = await prisma.member.findMany({
        where: { id: { in: memberIds } },
        select: { id: true, firstName: true, lastName: true, beltRank: true },
      });
      const memberMap = new Map(members.map((m) => [m.id, m]));

      entries = sorted.map(([memberId, points], i) => {
        const member = memberMap.get(memberId);
        const medals = memberMedals.get(memberId) || 0;
        return {
          rank: i + 1,
          memberId,
          name: member
            ? `${member.firstName} ${member.lastName}`
            : "Unknown",
          beltRank: member?.beltRank || "white",
          value: points,
          label: `pts (${medals} ${medals === 1 ? "medal" : "medals"})`,
        };
      });
    }
  } else if (category === "goals") {
    const completedGoals = await prisma.personalGoal.findMany({
      where: {
        completed: true,
        updatedAt: dateFilter,
      },
      select: { memberId: true },
    });

    const memberGoalCount = new Map<string, number>();
    for (const g of completedGoals) {
      memberGoalCount.set(
        g.memberId,
        (memberGoalCount.get(g.memberId) || 0) + 1
      );
    }

    const sorted = [...memberGoalCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);

    if (sorted.length > 0) {
      const memberIds = sorted.map(([id]) => id);
      const members = await prisma.member.findMany({
        where: { id: { in: memberIds } },
        select: { id: true, firstName: true, lastName: true, beltRank: true },
      });
      const memberMap = new Map(members.map((m) => [m.id, m]));

      entries = sorted.map(([memberId, count], i) => {
        const member = memberMap.get(memberId);
        return {
          rank: i + 1,
          memberId,
          name: member
            ? `${member.firstName} ${member.lastName}`
            : "Unknown",
          beltRank: member?.beltRank || "white",
          value: count,
          label: count === 1 ? "goal" : "goals",
        };
      });
    }
  }

  return (
    <MemberShell>
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <h1 className="text-2xl font-bold text-white uppercase tracking-wider">
            Leaderboard
          </h1>
          <a
            href="/members/leaderboard/goals"
            className="text-sm text-brand-teal hover:text-brand-teal/80 transition font-medium"
          >
            My Goals &rarr;
          </a>
        </div>

        <PeriodToggle />
        <LeaderboardTabs />
        <LeaderboardTable entries={entries} currentMemberId={currentMemberId} />
      </div>
    </MemberShell>
  );
}
