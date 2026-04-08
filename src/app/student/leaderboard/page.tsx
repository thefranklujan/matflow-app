export const dynamic = "force-dynamic";

import { getSession } from "@/lib/local-auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Trophy } from "lucide-react";

const BELT_BAR: Record<string, string> = {
  white: "bg-white",
  blue: "bg-blue-500",
  purple: "bg-purple-500",
  brown: "bg-amber-700",
  black: "bg-neutral-900 border border-white/30",
};

export default async function StudentLeaderboardPage() {
  const session = await getSession();
  if (!session?.studentId) redirect("/sign-in");
  const studentId = session.studentId;

  const me = await prisma.student.findUnique({
    where: { id: studentId },
    select: { homeGym: true },
  });

  // Pool = all students with the same homeGym (case-insensitive). Fallback to
  // platform-wide if no homeGym set.
  const pool = me?.homeGym
    ? await prisma.student.findMany({
        where: { homeGym: { equals: me.homeGym, mode: "insensitive" } },
        select: { id: true, firstName: true, lastName: true, beltRank: true, stripes: true, avatarUrl: true },
      })
    : await prisma.student.findMany({
        take: 500,
        select: { id: true, firstName: true, lastName: true, beltRank: true, stripes: true, avatarUrl: true },
      });

  const poolIds = pool.map((s) => s.id);
  const poolMap = new Map(pool.map((s) => [s.id, s]));

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [monthAgg, allTimeAgg] = await Promise.all([
    prisma.trainingSession.groupBy({
      by: ["studentId"],
      where: { studentId: { in: poolIds }, date: { gte: startOfMonth } },
      _count: { _all: true },
      _sum: { duration: true },
    }),
    prisma.trainingSession.groupBy({
      by: ["studentId"],
      where: { studentId: { in: poolIds } },
      _count: { _all: true },
      _sum: { duration: true },
    }),
  ]);

  const monthRows = monthAgg
    .map((r) => {
      const s = poolMap.get(r.studentId);
      if (!s) return null;
      return {
        id: s.id,
        name: `${s.firstName} ${s.lastName}`.trim(),
        belt: s.beltRank || "white",
        stripes: s.stripes || 0,
        avatar: s.avatarUrl,
        sessions: r._count._all,
        hours: Math.round((r._sum.duration || 0) / 60),
      };
    })
    .filter((r): r is NonNullable<typeof r> => !!r)
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 20);

  const allTimeRows = allTimeAgg
    .map((r) => {
      const s = poolMap.get(r.studentId);
      if (!s) return null;
      return {
        id: s.id,
        name: `${s.firstName} ${s.lastName}`.trim(),
        belt: s.beltRank || "white",
        stripes: s.stripes || 0,
        avatar: s.avatarUrl,
        sessions: r._count._all,
        hours: Math.round((r._sum.duration || 0) / 60),
      };
    })
    .filter((r): r is NonNullable<typeof r> => !!r)
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 20);

  const myMonthRank = monthRows.findIndex((r) => r.id === studentId) + 1;

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-2">
            <Trophy className="h-7 w-7 text-[#dc2626]" /> Leaderboard
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {me?.homeGym ? `Top grinders at ${me.homeGym}` : "Top grinders on MatFlow"}
          </p>
        </div>
        {myMonthRank > 0 && (
          <div className="bg-[#0a0a0a] border border-[#dc2626]/30 rounded-xl px-4 py-3 text-center">
            <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Your Rank</p>
            <p className="text-2xl font-bold text-[#dc2626]">#{myMonthRank}</p>
          </div>
        )}
      </div>

      <LeaderboardTable title="This Month" rows={monthRows} highlightId={studentId} />
      <div className="mt-8" />
      <LeaderboardTable title="All Time" rows={allTimeRows} highlightId={studentId} />
    </div>
  );
}

function LeaderboardTable({
  title,
  rows,
  highlightId,
}: {
  title: string;
  rows: Array<{ id: string; name: string; belt: string; stripes: number; avatar: string | null; sessions: number; hours: number }>;
  highlightId: string;
}) {
  if (rows.length === 0) {
    return (
      <div>
        <h2 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-3">{title}</h2>
        <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-5">
          <p className="text-gray-600 text-sm">No sessions logged yet.</p>
        </div>
      </div>
    );
  }
  return (
    <div>
      <h2 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-3">{title}</h2>
      <div className="bg-[#0a0a0a] border border-white/10 rounded-xl overflow-hidden">
        {rows.map((r, i) => {
          const rank = i + 1;
          const isMe = r.id === highlightId;
          const medal = rank === 1 ? "#fbbf24" : rank === 2 ? "#d4d4d4" : rank === 3 ? "#b45309" : null;
          return (
            <div
              key={r.id}
              className={`flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-b-0 ${
                isMe ? "bg-[#dc2626]/8" : ""
              }`}
            >
              <div
                className={`h-8 w-8 rounded-lg flex items-center justify-center font-bold text-sm shrink-0`}
                style={
                  medal
                    ? { background: medal, color: "#000" }
                    : undefined
                }
              >
                {!medal && <span className="text-gray-500">{rank}</span>}
                {medal && rank}
              </div>
              {r.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.avatar} alt={r.name} className="h-9 w-9 rounded-full object-cover border border-white/10" />
              ) : (
                <div className="h-9 w-9 rounded-full bg-[#dc2626]/20 text-[#dc2626] flex items-center justify-center font-bold text-xs border border-white/10">
                  {r.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm truncate">
                  {r.name} {isMe && <span className="text-[#dc2626] text-[10px] font-normal">(you)</span>}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`inline-block h-2 w-10 rounded-sm ${BELT_BAR[r.belt] || BELT_BAR.white}`} />
                  {r.stripes > 0 && (
                    <span className="flex items-center gap-0.5">
                      {Array.from({ length: r.stripes }).map((_, j) => (
                        <span key={j} className="inline-block h-2 w-[2px] rounded-sm bg-white/70" />
                      ))}
                    </span>
                  )}
                  <span className="text-gray-500 text-xs">{r.hours}h</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-white text-xl font-bold leading-none">{r.sessions}</p>
                <p className="text-gray-500 text-[10px] uppercase tracking-wider">sessions</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
