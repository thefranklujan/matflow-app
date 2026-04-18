export const dynamic = "force-dynamic";

import { getSession } from "@/lib/local-auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Search, Inbox, Building2, Calendar, Video, Megaphone, ShoppingBag, Flame, CalendarDays, TrendingUp, Clock } from "lucide-react";
import { computeStreaks } from "@/lib/streaks";
import WeeklyGoalRing from "@/components/student/WeeklyGoalRing";
import WhosTrainingToday from "@/components/student/WhosTrainingToday";
import AutoLogTodayButton from "@/components/student/AutoLogTodayButton";

export default async function StudentDashboardPage() {
  const session = await getSession();
  if (!session?.studentId) redirect("/sign-in");

  const studentId = session.studentId;

  const studentRecord = await prisma.student.findUnique({
    where: { id: studentId },
    select: { weeklyGoal: true, homeGym: true },
  });
  const weeklyGoal = studentRecord?.weeklyGoal ?? 4;
  const myHomeGym = studentRecord?.homeGym || null;

  const [memberships, requests, activeGyms, nominatedGroups] = await Promise.all([
    prisma.member.findMany({
      where: { studentId },
      include: { gym: { select: { id: true, name: true, slug: true, city: true, state: true, logo: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.joinRequest.findMany({
      where: { studentId },
      include: { gym: { select: { name: true, slug: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.gym.findMany({
      take: 4,
      where: {
        id: { notIn: ["platform-owner-gym", "platform-admin-gym"] },
        subscriptionStatus: { not: "cancelled" },
        approved: true,
        hidden: false,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.gymGroup.findMany({
      orderBy: { memberCount: "desc" },
      take: 6,
      select: { id: true, name: true, city: true, state: true, memberCount: true },
    }),
  ]);

  // Build the unified Suggested Gyms list: active gyms first, then nominated groups
  // (deduped by name) so students see every gym available on the platform.
  const activeNames = new Set(activeGyms.map((g) => g.name.toLowerCase().trim()));
  type SuggestedCard = {
    key: string;
    name: string;
    city: string | null;
    state: string | null;
    href: string;
    isActive: boolean;
    memberCount?: number;
  };
  const suggestedGyms: SuggestedCard[] = [
    ...activeGyms.map((g) => ({
      key: `gym-${g.id}`,
      name: g.name,
      city: g.city,
      state: g.state,
      href: `/student/gyms/${g.slug}`,
      isActive: true,
    })),
    ...nominatedGroups
      .filter((n) => !activeNames.has(n.name.toLowerCase().trim()))
      .map((n) => ({
        key: `nom-${n.id}`,
        name: n.name,
        city: n.city,
        state: n.state,
        href: `/student/nominate`,
        isActive: false,
        memberCount: n.memberCount,
      })),
  ].slice(0, 8);

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  // Training log summary
  const [totalSessions, trainingAgg, recentSessions] = await Promise.all([
    prisma.trainingSession.count({ where: { studentId } }),
    prisma.trainingSession.aggregate({
      where: { studentId },
      _sum: { duration: true, rollsWon: true, rollsLost: true },
    }),
    prisma.trainingSession.findMany({
      where: { studentId },
      orderBy: { date: "desc" },
      take: 3,
    }),
  ]);
  const totalHours = Math.round((trainingAgg._sum.duration || 0) / 60);
  const totalRolls = (trainingAgg._sum.rollsWon || 0) + (trainingAgg._sum.rollsLost || 0);
  const winRate = totalRolls > 0 ? Math.round(((trainingAgg._sum.rollsWon || 0) / totalRolls) * 100) : 0;

  // Metrics: this week, this month, streak
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const allSessionDates = await prisma.trainingSession.findMany({
    where: { studentId },
    orderBy: { date: "desc" },
    select: { date: true },
  });
  const sessionsThisWeek = allSessionDates.filter((s) => s.date >= startOfWeek).length;
  const sessionsThisMonth = allSessionDates.filter((s) => s.date >= startOfMonth).length;
  const streaks = computeStreaks(allSessionDates.map((s) => s.date.toISOString()));

  // Today: my planned training (if any) and friends training today
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const [myTodayPlan, loggedToday, friendsToday] = await Promise.all([
    prisma.studentTrainingPlan.findFirst({
      where: { studentId, date: { gte: todayStart, lt: todayEnd } },
    }),
    prisma.trainingSession.count({
      where: { studentId, date: { gte: todayStart, lt: todayEnd } },
    }),
    myHomeGym
      ? prisma.studentTrainingPlan.findMany({
          where: {
            date: { gte: todayStart, lt: todayEnd },
            NOT: { studentId },
            student: {
              shareSchedule: true,
              homeGym: { equals: myHomeGym, mode: "insensitive" },
            },
          },
          include: {
            student: { select: { firstName: true, lastName: true, avatarUrl: true } },
          },
          take: 20,
        })
      : Promise.resolve([]),
  ]);

  const blockLabel = (p: { morning: boolean; noon: boolean; afternoon: boolean }) => {
    const b: string[] = [];
    if (p.morning) b.push("Morning");
    if (p.noon) b.push("Noon");
    if (p.afternoon) b.push("Afternoon");
    return b.join(" + ") || "Training";
  };

  const friendsTodayList = friendsToday.map((f) => ({
    name: f.student ? `${f.student.firstName} ${f.student.lastName}`.trim() : "Friend",
    avatarUrl: f.student?.avatarUrl || null,
    block: blockLabel(f),
    gym: f.gym,
  }));

  const showAutoLog = !!myTodayPlan && loggedToday === 0;

  // Pull a snapshot of content from each approved gym
  const gymIds = memberships.map((m) => m.gymId);
  const todayDow = new Date().getDay();
  const [todaysClasses, recentVideos, recentAnnouncements, recentProducts] = gymIds.length
    ? await Promise.all([
        prisma.classSchedule.findMany({
          where: { gymId: { in: gymIds }, dayOfWeek: todayDow, active: true },
          orderBy: { startTime: "asc" },
          take: 6,
          include: { gym: { select: { name: true } } },
        }),
        prisma.video.findMany({
          where: { gymId: { in: gymIds } },
          orderBy: { createdAt: "desc" },
          take: 4,
          include: { gym: { select: { name: true } } },
        }),
        prisma.announcement.findMany({
          where: { gymId: { in: gymIds } },
          orderBy: [{ pinned: "desc" }, { publishedAt: "desc" }],
          take: 4,
          include: { gym: { select: { name: true } } },
        }),
        prisma.product.findMany({
          where: { gymId: { in: gymIds }, active: true },
          orderBy: { createdAt: "desc" },
          take: 6,
          include: { gym: { select: { name: true } } },
        }),
      ])
    : [[], [], [], []] as const;

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-2">Welcome, {session.name.split(" ")[0]}</h1>
      <p className="text-gray-500 mb-6">Your training, your gyms, your community.</p>

      {showAutoLog && myTodayPlan && (
        <div className="mb-6">
          <AutoLogTodayButton
            plannedGym={myTodayPlan.gym}
            plannedBlock={blockLabel(myTodayPlan)}
          />
        </div>
      )}

      <WhosTrainingToday friends={friendsTodayList} />

      {/* Quick Metrics */}
      <section className="mb-10">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-lg bg-[#dc2626]/15 flex items-center justify-center">
                <CalendarDays className="h-4 w-4 text-[#dc2626]" />
              </div>
              <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">This Week</p>
            </div>
            <p className="text-3xl font-bold text-white">{sessionsThisWeek}</p>
            <p className="text-gray-500 text-xs mt-0.5">session{sessionsThisWeek === 1 ? "" : "s"}</p>
          </div>

          <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-lg bg-[#dc2626]/15 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-[#dc2626]" />
              </div>
              <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">This Month</p>
            </div>
            <p className="text-3xl font-bold text-white">{sessionsThisMonth}</p>
            <p className="text-gray-500 text-xs mt-0.5">session{sessionsThisMonth === 1 ? "" : "s"}</p>
          </div>

          <div className="bg-gradient-to-br from-orange-500/15 to-[#dc2626]/5 border border-orange-500/30 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
                <Flame className="h-4 w-4 text-orange-400" />
              </div>
              <p className="text-[10px] uppercase tracking-wider text-orange-300 font-semibold">Streak</p>
            </div>
            <p className="text-3xl font-bold text-white">{streaks.current}</p>
            <p className="text-gray-400 text-xs mt-0.5">day{streaks.current === 1 ? "" : "s"} · best {streaks.longest}</p>
          </div>

          <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-lg bg-[#dc2626]/15 flex items-center justify-center">
                <Clock className="h-4 w-4 text-[#dc2626]" />
              </div>
              <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Total Hours</p>
            </div>
            <p className="text-3xl font-bold text-white">{totalHours}</p>
            <p className="text-gray-500 text-xs mt-0.5">all time</p>
          </div>

          <WeeklyGoalRing current={sessionsThisWeek} goal={weeklyGoal} />
        </div>
      </section>

      {/* My Gyms */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">My Gyms</h2>
          <Link href="/student/gyms" className="text-[#dc2626] text-sm hover:underline">Find more</Link>
        </div>

        {memberships.length === 0 ? (
          <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-10 text-center">
            <Building2 className="h-12 w-12 text-gray-600 mx-auto mb-4" />
            <p className="text-white font-semibold mb-2">You are not a member of any gym yet</p>
            <p className="text-gray-500 text-sm mb-6">Find your gym, request to join, and get full access to schedule, videos, attendance, and belt tracking.</p>
            <Link href="/student/gyms" className="inline-flex items-center gap-2 bg-[#dc2626] hover:bg-[#b91c1c] text-white font-bold px-6 py-3 rounded-lg transition">
              <Search className="h-4 w-4" /> Find a Gym
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {memberships.map((m) => (
              <form key={m.id} action={`/api/student/switch-gym/${m.gymId}`} method="POST">
                <button type="submit" className="w-full text-left bg-[#0a0a0a] border border-white/10 rounded-xl p-5 hover:border-[#dc2626] transition group">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-10 w-10 rounded-lg bg-[#dc2626]/10 flex items-center justify-center text-[#dc2626] text-sm font-bold">
                      {m.gym.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-white font-semibold">{m.gym.name}</p>
                      {m.gym.city && <p className="text-gray-500 text-xs">{m.gym.city}{m.gym.state ? `, ${m.gym.state}` : ""}</p>}
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 capitalize">{m.beltRank} belt {m.stripes > 0 && `(${m.stripes})`}</p>
                  <p className="text-[#dc2626] text-xs font-medium mt-2 group-hover:underline">Open Gym &rarr;</p>
                </button>
              </form>
            ))}
          </div>
        )}
      </section>

      {/* Training Log Summary */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Training Log</h2>
          <Link href="/student/training" className="text-[#dc2626] text-sm hover:underline">Log session</Link>
        </div>
        {totalSessions === 0 ? (
          <Link href="/student/training" className="block bg-[#0a0a0a] border border-dashed border-white/15 rounded-xl p-8 text-center hover:border-[#dc2626] transition">
            <p className="text-white font-semibold mb-1">Start your training log</p>
            <p className="text-gray-500 text-sm">Track techniques, partners, rolls, and time on the mat.</p>
          </Link>
        ) : (
          <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Sessions</p>
                <p className="text-2xl font-bold text-white mt-1">{totalSessions}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Hours</p>
                <p className="text-2xl font-bold text-white mt-1">{totalHours}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Rolls</p>
                <p className="text-2xl font-bold text-white mt-1">{totalRolls}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Win %</p>
                <p className="text-2xl font-bold text-[#dc2626] mt-1">{winRate}%</p>
              </div>
            </div>
            {recentSessions.length > 0 && (
              <div className="space-y-1 pt-4 border-t border-white/5">
                {recentSessions.map((s) => (
                  <div key={s.id} className="flex items-center justify-between text-sm py-1">
                    <span className="text-white">{new Date(s.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                    <span className="text-gray-400">{s.sessionType} · {s.duration} min</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Nominate Your Gym */}
      {memberships.length === 0 && (
        <section className="mb-10">
          <Link href="/student/nominate" className="block bg-gradient-to-br from-[#dc2626]/20 to-black border border-[#dc2626]/30 rounded-xl p-6 hover:border-[#dc2626] transition">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-white font-bold text-lg mb-1">Your gym isn&apos;t on MatFlow yet?</p>
                <p className="text-gray-400 text-sm">Nominate your academy. When enough students nominate, we&apos;ll reach out to the owner and activate it for free.</p>
              </div>
              <span className="text-[#dc2626] text-2xl">→</span>
            </div>
          </Link>
        </section>
      )}

      {/* Pending Requests */}
      {pendingCount > 0 && (
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Pending Requests</h2>
            <Link href="/student/requests" className="text-[#dc2626] text-sm hover:underline">View all</Link>
          </div>
          <div className="bg-[#0a0a0a] border border-yellow-500/30 rounded-xl divide-y divide-white/5">
            {requests.filter((r) => r.status === "pending").slice(0, 3).map((r) => (
              <div key={r.id} className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <Inbox className="h-4 w-4 text-yellow-400" />
                  <p className="text-white text-sm">{r.gym.name}</p>
                </div>
                <span className="text-xs text-yellow-400 font-medium">Awaiting approval</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Today's Schedule across all gyms */}
      {todaysClasses.length > 0 && (
        <section className="mb-10">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Calendar className="h-4 w-4" /> Today at Your Gyms
          </h2>
          <div className="bg-[#0a0a0a] border border-white/10 rounded-xl divide-y divide-white/5">
            {todaysClasses.map((c) => (
              <div key={c.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-white text-sm font-medium">{c.classType}{c.topic ? ` · ${c.topic}` : ""}</p>
                  <p className="text-gray-500 text-xs">{c.gym.name} · {c.instructor}</p>
                </div>
                <p className="text-[#dc2626] text-sm font-medium">{c.startTime} to {c.endTime}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Announcements */}
      {recentAnnouncements.length > 0 && (
        <section className="mb-10">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Megaphone className="h-4 w-4" /> Announcements
          </h2>
          <div className="space-y-3">
            {recentAnnouncements.map((a) => (
              <div key={a.id} className="bg-[#0a0a0a] border border-white/10 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  {a.pinned && <span className="bg-green-500/20 text-green-400 text-[10px] px-2 py-0.5 rounded font-semibold uppercase">Pinned</span>}
                  <p className="text-white text-sm font-semibold">{a.title}</p>
                </div>
                <p className="text-gray-400 text-sm">{a.content}</p>
                <p className="text-gray-600 text-xs mt-1">{a.gym.name}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Latest Videos */}
      {recentVideos.length > 0 && (
        <section className="mb-10">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Video className="h-4 w-4" /> Latest Videos
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {recentVideos.map((v) => (
              <div key={v.id} className="bg-[#0a0a0a] border border-white/10 rounded-xl p-4">
                <p className="text-white text-sm font-semibold">{v.title}</p>
                <p className="text-gray-500 text-xs mt-1">{v.gym.name}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Products */}
      {recentProducts.length > 0 && (
        <section className="mb-10">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <ShoppingBag className="h-4 w-4" /> Gym Store
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {recentProducts.map((p) => (
              <div key={p.id} className="bg-[#0a0a0a] border border-white/10 rounded-xl p-4">
                <p className="text-white text-sm font-semibold">{p.name}</p>
                <p className="text-[#dc2626] text-sm font-bold mt-1">${p.price.toFixed(2)}</p>
                <p className="text-gray-600 text-xs mt-1">{p.gym.name}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Active gyms on MatFlow */}
      {memberships.length === 0 && suggestedGyms.filter((g) => g.isActive).length > 0 && (
        <section>
          <div className="mb-4">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Gyms on MatFlow</h2>
            <p className="text-gray-500 text-xs mt-0.5">
              These academies are active — tap to request to join.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {suggestedGyms.filter((g) => g.isActive).map((gym) => (
              <Link
                key={gym.key}
                href={gym.href}
                className="bg-[#0a0a0a] border border-white/10 hover:border-[#dc2626] rounded-xl p-5 transition"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-lg flex items-center justify-center text-sm font-bold bg-[#dc2626]/10 text-[#dc2626] shrink-0">
                    {gym.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-white font-semibold truncate">{gym.name}</p>
                    {gym.city && <p className="text-gray-500 text-xs">{gym.city}{gym.state ? `, ${gym.state}` : ""}</p>}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Nominated gyms — not yet on MatFlow */}
      {memberships.length === 0 && suggestedGyms.filter((g) => !g.isActive).length > 0 && (
        <section>
          <div className="mb-4">
            <h2 className="text-sm font-bold text-yellow-400 uppercase tracking-wider">Not Yet on MatFlow</h2>
            <p className="text-gray-500 text-xs mt-0.5">
              Students nominated these gyms. Nominate yours too, and we&apos;ll reach out to the owner.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {suggestedGyms.filter((g) => !g.isActive).map((gym) => (
              <Link
                key={gym.key}
                href={gym.href}
                className="bg-[#0a0a0a] border border-yellow-500/20 hover:border-yellow-500/50 rounded-xl p-5 transition"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-lg flex items-center justify-center text-sm font-bold bg-yellow-500/10 text-yellow-400 shrink-0">
                      {gym.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-white font-semibold truncate">{gym.name}</p>
                      {gym.city && <p className="text-gray-500 text-xs">{gym.city}{gym.state ? `, ${gym.state}` : ""}</p>}
                      <p className="text-yellow-400/80 text-[10px] mt-0.5">
                        {gym.memberCount ?? 0} student{(gym.memberCount ?? 0) === 1 ? "" : "s"} nominating
                      </p>
                    </div>
                  </div>
                  <span className="bg-yellow-500/20 text-yellow-400 text-[10px] uppercase tracking-wider font-semibold px-2 py-1 rounded shrink-0">
                    Not Active
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
