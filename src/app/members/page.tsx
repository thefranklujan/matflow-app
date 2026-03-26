import { requireMember } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import BeltDisplay from "@/components/members/BeltDisplay";
import Link from "next/link";
import { formatTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export default async function MemberDashboardPage() {
  const { memberId } = await requireMember();

  const now = new Date();
  const todayDayOfWeek = now.getDay(); // 0=Sunday
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [member, announcements, todaySchedule, monthlyAttendance] =
    await Promise.all([
      memberId
        ? prisma.member.findUnique({
            where: { id: memberId },
            select: {
              firstName: true,
              lastName: true,
              beltRank: true,
              stripes: true,
            },
          })
        : null,
      prisma.announcement.findMany({
        orderBy: [{ pinned: "desc" }, { publishedAt: "desc" }],
        take: 3,
      }),
      prisma.classSchedule.findMany({
        where: { active: true, dayOfWeek: todayDayOfWeek },
        orderBy: { startTime: "asc" },
      }),
      memberId
        ? prisma.attendance.count({
            where: {
              memberId,
              classDate: { gte: startOfMonth },
            },
          })
        : 0,
    ]);

  return (
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Welcome */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white uppercase tracking-wider">
              Welcome back, {member?.firstName || "Member"}
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              {DAY_NAMES[todayDayOfWeek]},{" "}
              {now.toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
          {member && (
            <BeltDisplay
              beltRank={member.beltRank}
              stripes={member.stripes}
              size="md"
            />
          )}
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link href="/members/attendance?filter=month" className="bg-brand-dark border border-brand-gray rounded-lg p-6 hover:border-brand-teal transition group cursor-pointer">
            <p className="text-sm text-gray-400 uppercase tracking-wider mb-1 group-hover:text-gray-300 transition">
              Classes This Month
            </p>
            <p className="text-3xl font-bold text-brand-teal">
              {monthlyAttendance}
            </p>
          </Link>
          <Link href="/members/progress" className="bg-brand-dark border border-brand-gray rounded-lg p-6 hover:border-brand-teal transition group cursor-pointer">
            <p className="text-sm text-gray-400 uppercase tracking-wider mb-1 group-hover:text-gray-300 transition">
              Current Belt
            </p>
            <p className="text-3xl font-bold text-white capitalize">
              {member?.beltRank || "White"}
            </p>
          </Link>
          <Link href="/members/progress" className="bg-brand-dark border border-brand-gray rounded-lg p-6 hover:border-brand-teal transition group cursor-pointer">
            <p className="text-sm text-gray-400 uppercase tracking-wider mb-1 group-hover:text-gray-300 transition">
              Stripes
            </p>
            <p className="text-3xl font-bold text-brand-teal">
              {member?.stripes || 0}
            </p>
          </Link>
        </div>

        {/* Today's Schedule */}
        <div className="bg-brand-dark border border-brand-gray rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white uppercase tracking-wider">
              Today&apos;s Schedule
            </h2>
            <Link
              href="/members/schedule"
              className="text-sm text-brand-teal hover:underline"
            >
              Full schedule
            </Link>
          </div>
          {todaySchedule.length > 0 ? (
            <div className="space-y-3">
              {todaySchedule.map((cls) => (
                <div
                  key={cls.id}
                  className="flex items-center justify-between py-3 border-b border-brand-gray last:border-0"
                >
                  <div>
                    <p className="text-white font-medium capitalize">{cls.classType}</p>
                    <p className="text-gray-500 text-sm">
                      {cls.instructor} &middot;{" "}
                      <span className="capitalize">{cls.locationSlug}</span>
                      {cls.topic && (
                        <span className="text-brand-teal/70"> · {cls.topic}</span>
                      )}
                    </p>
                  </div>
                  <p className="text-brand-teal font-semibold text-sm">
                    {formatTime(cls.startTime)} - {formatTime(cls.endTime)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">
              No classes scheduled for today.
            </p>
          )}
        </div>

        {/* Announcements */}
        <div className="bg-brand-dark border border-brand-gray rounded-lg p-6">
          <h2 className="text-lg font-semibold text-white uppercase tracking-wider mb-4">
            Announcements
          </h2>
          {announcements.length > 0 ? (
            <div className="space-y-4">
              {announcements.map((a) => (
                <div
                  key={a.id}
                  className="py-3 border-b border-brand-gray last:border-0"
                >
                  <div className="flex items-center gap-2 mb-1">
                    {a.pinned && (
                      <span className="text-xs bg-brand-teal/20 text-brand-teal px-2 py-0.5 rounded-full">
                        Pinned
                      </span>
                    )}
                    <h3 className="text-white font-medium">{a.title}</h3>
                  </div>
                  <p className="text-gray-400 text-sm line-clamp-2">
                    {a.content}
                  </p>
                  <p className="text-gray-600 text-xs mt-1">
                    {new Date(a.publishedAt).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No announcements.</p>
          )}
        </div>
      </div>
  );
}
