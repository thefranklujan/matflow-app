export const dynamic = "force-dynamic";

import { getAuthContext } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Building2, UserPlus, GraduationCap, CalendarPlus, Share2, CreditCard } from "lucide-react";
import { formatTime } from "@/lib/utils";
import { ShareLinkCard } from "@/components/ShareLinkCard";
import { SetupChecklist, type SetupStep } from "@/components/SetupChecklist";
import { evaluateActivation, trialDaysRemaining } from "@/lib/activation";
import type { MilestoneKey } from "@/lib/activation";

/** Icons for the shared activation milestones. */
const MILESTONE_ICONS: Record<MilestoneKey, typeof Building2> = {
  profile: Building2,
  firstMember: UserPlus,
  instructor: GraduationCap,
  schedule: CalendarPlus,
};

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default async function DashboardPage() {
  let ctx;
  try {
    ctx = await getAuthContext();
  } catch {
    redirect("/sign-in");
  }

  if (!ctx.gymId) redirect("/sign-in");

  const isAdmin = ctx.orgRole === "org:admin";

  if (isAdmin) {
    return <AdminDashboard gymId={ctx.gymId} />;
  }
  return <MemberDashboard gymId={ctx.gymId} memberId={ctx.memberId!} />;
}

async function AdminDashboard({ gymId }: { gymId: string }) {
  const now = new Date();
  const todayDayOfWeek = now.getDay();
  const RECENT_DAYS = 30;
  const recentSince = new Date(now.getTime() - RECENT_DAYS * 24 * 60 * 60 * 1000);

  const [
    memberCount,
    instructorCount,
    scheduleCount,
    attendanceTotal,
    recentCheckIns,
    todayClasses,
    recentAttendance,
    gym,
  ] = await Promise.all([
    prisma.member.count({ where: { gymId, active: true, approved: true } }),
    prisma.instructor.count({ where: { gymId, active: true } }),
    prisma.classSchedule.count({ where: { gymId, active: true } }),
    prisma.attendance.count({ where: { gymId } }),
    prisma.attendance.count({ where: { gymId, classDate: { gte: recentSince } } }),
    prisma.classSchedule.findMany({
      where: { gymId, dayOfWeek: todayDayOfWeek, active: true },
      orderBy: { startTime: "asc" },
      take: 6,
    }),
    prisma.attendance.findMany({
      where: { gymId },
      orderBy: { checkedInAt: "desc" },
      take: 5,
      include: { member: { select: { firstName: true, lastName: true } } },
    }),
    prisma.gym.findUnique({
      where: { id: gymId },
      select: {
        name: true,
        slug: true,
        description: true,
        city: true,
        state: true,
        subscriptionStatus: true,
        trialEndsAt: true,
      },
    }),
  ]);

  // ONE activation definition, shared with the founder sales queue.
  const activation = evaluateActivation({
    description: gym?.description ?? null,
    city: gym?.city ?? null,
    state: gym?.state ?? null,
    activeMemberCount: memberCount,
    activeInstructorCount: instructorCount,
    activeScheduleCount: scheduleCount,
    attendanceCount: attendanceTotal,
  });

  const daysLeft = trialDaysRemaining(gym?.trialEndsAt ?? null, now);
  const subscriptionStatus = gym?.subscriptionStatus ?? "unknown";
  const billingLine =
    subscriptionStatus === "active"
      ? "Subscription active"
      : subscriptionStatus === "trialing" && daysLeft !== null
        ? daysLeft >= 0
          ? `Trial ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`
          : "Trial ended"
        : subscriptionStatus === "past_due"
          ? "Payment needs attention"
          : subscriptionStatus === "canceled"
            ? "Subscription canceled"
            : "Review your plan";

  // Operational figures — what running an academy actually looks like.
  const stats = [
    { label: "Active members", value: memberCount, href: "/app/members" },
    { label: "Instructors", value: instructorCount, href: "/app/instructors" },
    { label: "Weekly classes", value: scheduleCount, href: "/app/schedule" },
    { label: `Check-ins (last ${RECENT_DAYS} days)`, value: recentCheckIns, href: "/app/attendance" },
  ];

  const setupSteps: SetupStep[] = [
    ...activation.milestones.map((m) => ({
      key: m.key,
      label: m.label,
      description: m.description,
      href: m.href,
      icon: MILESTONE_ICONS[m.key],
      done: m.complete,
    })),
    // Actions we cannot derive: never shown as fabricated "incomplete" items.
    { key: "share", label: "Share your invite link", description: "Send your join link to start bringing students in.", href: "/app/members", icon: Share2, done: null },
    { key: "billing", label: "Review trial and billing", description: `${billingLine}.`, href: "/app/billing", icon: CreditCard, done: null },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <Link
          href="/app/billing"
          className={`text-sm ${subscriptionStatus === "past_due" ? "text-red-400" : "text-gray-400"} hover:text-white transition`}
        >
          {billingLine}
        </Link>
      </div>

      {gym && !activation.isActivated && (
        <SetupChecklist steps={setupSteps} gymName={gym.name} />
      )}

      {/* After activation the setup treatment shrinks to a single quiet line. */}
      {gym && activation.isActivated && (
        <p className="text-sm text-gray-400 mb-6">
          Setup complete.{" "}
          {activation.hasLiveUsage ? (
            <>Your academy is live — {recentCheckIns} check-in{recentCheckIns === 1 ? "" : "s"} in the last {RECENT_DAYS} days.</>
          ) : (
            <>
              Next: record your first check-in.{" "}
              <Link href="/app/attendance" className="text-[#c4b5a0] underline">Take attendance</Link>.
            </>
          )}
        </p>
      )}

      {gym?.slug && (
        <div className="mb-6">
          <ShareLinkCard slug={gym.slug} />
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="bg-[#1a1a1a] border border-white/10 rounded-lg p-6 hover:border-[#c4b5a0]/30 transition"
          >
            <p className="text-sm text-gray-400 mb-1">{stat.label}</p>
            <p className="text-3xl font-bold text-[#c4b5a0]">{stat.value}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#1a1a1a] border border-white/10 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Today&apos;s classes</h2>
            <Link href="/app/schedule" className="text-sm text-[#c4b5a0] hover:underline">Schedule</Link>
          </div>
          {todayClasses.length > 0 ? (
            <ul className="space-y-3">
              {todayClasses.map((cls) => (
                <li key={cls.id} className="flex items-center justify-between gap-3 border-b border-white/5 pb-3 last:border-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="text-white text-sm font-medium capitalize truncate">{cls.classType}</p>
                    <p className="text-gray-400 text-xs truncate">{cls.instructor}</p>
                  </div>
                  <p className="text-[#c4b5a0] text-sm whitespace-nowrap">
                    {formatTime(cls.startTime)} - {formatTime(cls.endTime)}
                  </p>
                </li>
              ))}
            </ul>
          ) : scheduleCount === 0 ? (
            <p className="text-sm text-gray-400">
              No classes yet.{" "}
              <Link href="/app/schedule" className="text-[#c4b5a0] underline">Create your first class</Link>.
            </p>
          ) : (
            <p className="text-sm text-gray-400">Nothing scheduled today.</p>
          )}
        </div>

        <div className="bg-[#1a1a1a] border border-white/10 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Recent check-ins</h2>
            <Link href="/app/attendance" className="text-sm text-[#c4b5a0] hover:underline">Attendance</Link>
          </div>
          {recentAttendance.length > 0 ? (
            <ul className="space-y-3">
              {recentAttendance.map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-3 border-b border-white/5 pb-3 last:border-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="text-white text-sm font-medium truncate">
                      {row.member.firstName} {row.member.lastName}
                    </p>
                    <p className="text-gray-400 text-xs capitalize truncate">{row.classType}</p>
                  </div>
                  <p className="text-gray-400 text-xs whitespace-nowrap">
                    {new Date(row.classDate).toLocaleDateString()}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-400">
              No check-ins yet.{" "}
              <Link href="/app/attendance" className="text-[#c4b5a0] underline">Record attendance</Link>{" "}
              to see who is training.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

async function MemberDashboard({ gymId, memberId }: { gymId: string; memberId: string }) {
  const now = new Date();
  const todayDayOfWeek = now.getDay();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [member, announcements, todaySchedule, monthlyAttendance] = await Promise.all([
    prisma.member.findUnique({ where: { id: memberId } }),
    prisma.announcement.findMany({
      where: { gymId },
      orderBy: [{ pinned: "desc" }, { publishedAt: "desc" }],
      take: 5,
    }),
    prisma.classSchedule.findMany({
      where: { gymId, dayOfWeek: todayDayOfWeek, active: true },
      orderBy: { startTime: "asc" },
    }),
    prisma.attendance.count({
      where: { memberId, classDate: { gte: startOfMonth } },
    }),
  ]);

  if (!member) return <p className="text-gray-400">Member not found</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white uppercase tracking-wide">
            Welcome back
          </h1>
          <p className="text-gray-400 text-sm">
            {DAY_NAMES[now.getDay()]}, {now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-[#1a1a1a] border border-white/10 rounded-lg p-5">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Classes This Month</p>
          <p className="text-2xl font-bold text-white">{monthlyAttendance}</p>
        </div>
        <div className="bg-[#1a1a1a] border border-white/10 rounded-lg p-5">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Current Belt</p>
          <p className="text-2xl font-bold text-white capitalize">{member.beltRank}</p>
        </div>
        <div className="bg-[#1a1a1a] border border-white/10 rounded-lg p-5">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Stripes</p>
          <p className="text-2xl font-bold text-[#c4b5a0]">{member.stripes}</p>
        </div>
      </div>

      {/* Today's Schedule */}
      <div className="bg-[#1a1a1a] border border-white/10 rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Today&apos;s Schedule</h2>
          <Link href="/app/schedule" className="text-[#c4b5a0] text-sm hover:underline">Full schedule</Link>
        </div>
        {todaySchedule.length > 0 ? (
          <div className="space-y-3">
            {todaySchedule.map((cls) => (
              <div key={cls.id} className="flex items-center justify-between">
                <div>
                  <p className="text-white font-medium">{cls.classType}</p>
                  <p className="text-gray-400 text-sm">{cls.instructor} &middot; {cls.locationSlug}{cls.topic ? ` &middot; ${cls.topic}` : ""}</p>
                </div>
                <p className="text-[#c4b5a0] text-sm font-medium">{formatTime(cls.startTime)} - {formatTime(cls.endTime)}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400 text-sm">No classes scheduled today.</p>
        )}
      </div>

      {/* Announcements */}
      {announcements.length > 0 && (
        <div className="bg-[#1a1a1a] border border-white/10 rounded-lg p-6">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Announcements</h2>
          <div className="space-y-4">
            {announcements.map((ann) => (
              <div key={ann.id}>
                <div className="flex items-center gap-2 mb-1">
                  {ann.pinned && <span className="bg-green-500/20 text-green-400 px-2 py-0.5 rounded text-xs font-medium">Pinned</span>}
                  <h3 className="text-white font-semibold">{ann.title}</h3>
                </div>
                <p className="text-gray-400 text-sm">{ann.content}</p>
                <p className="text-gray-400 text-xs mt-1">{new Date(ann.publishedAt).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
