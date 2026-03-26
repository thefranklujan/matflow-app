import { requireMember } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import MemberShell from "@/components/members/MemberShell";
import Link from "next/link";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function MemberAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const params = await searchParams;
  const { memberId } = await requireMember();
  const filter = params.filter || "all";

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const attendanceWhere: Record<string, unknown> = memberId ? { memberId } : {};
  if (filter === "month" && memberId) {
    attendanceWhere.classDate = { gte: startOfMonth };
  }

  const [totalCount, monthlyCount, attendance] = await Promise.all([
    memberId ? prisma.attendance.count({ where: { memberId } }) : 0,
    memberId
      ? prisma.attendance.count({
          where: { memberId, classDate: { gte: startOfMonth } },
        })
      : 0,
    memberId
      ? prisma.attendance.findMany({
          where: attendanceWhere,
          orderBy: { classDate: "desc" },
          take: 100,
        })
      : [],
  ]);

  // Calculate streak
  let streak = 0;
  if (attendance.length > 0) {
    const uniqueDates = [
      ...new Set(
        attendance.map((a) =>
          new Date(a.classDate).toISOString().split("T")[0]
        )
      ),
    ].sort((a, b) => b.localeCompare(a));

    // Count consecutive weeks with at least one class
    const today = new Date();
    const currentWeekStart = new Date(today);
    currentWeekStart.setDate(today.getDate() - today.getDay());
    currentWeekStart.setHours(0, 0, 0, 0);

    let weekStart = new Date(currentWeekStart);
    let foundThisWeek = true;

    while (foundThisWeek) {
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 7);

      foundThisWeek = uniqueDates.some((d) => {
        const date = new Date(d);
        return date >= weekStart && date < weekEnd;
      });

      if (foundThisWeek) {
        streak++;
        weekStart.setDate(weekStart.getDate() - 7);
      }
    }
  }

  return (
    <MemberShell>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-white uppercase tracking-wider mb-8">
          Attendance
        </h1>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <Link href="/members/attendance?filter=all" className={cn(
            "bg-brand-dark border rounded-lg p-6 hover:border-brand-teal transition group cursor-pointer",
            filter === "all" ? "border-brand-teal" : "border-brand-gray"
          )}>
            <p className="text-sm text-gray-400 uppercase tracking-wider mb-1 group-hover:text-gray-300 transition">
              Total Classes
            </p>
            <p className="text-3xl font-bold text-brand-teal">{totalCount}</p>
          </Link>
          <Link href="/members/attendance?filter=month" className={cn(
            "bg-brand-dark border rounded-lg p-6 hover:border-brand-teal transition group cursor-pointer",
            filter === "month" ? "border-brand-teal" : "border-brand-gray"
          )}>
            <p className="text-sm text-gray-400 uppercase tracking-wider mb-1 group-hover:text-gray-300 transition">
              This Month
            </p>
            <p className="text-3xl font-bold text-white">{monthlyCount}</p>
          </Link>
          <Link href="/members/leaderboard" className="bg-brand-dark border border-brand-gray rounded-lg p-6 hover:border-brand-teal transition group cursor-pointer">
            <p className="text-sm text-gray-400 uppercase tracking-wider mb-1 group-hover:text-gray-300 transition">
              Week Streak
            </p>
            <p className="text-3xl font-bold text-brand-teal">
              {streak} {streak === 1 ? "week" : "weeks"}
            </p>
          </Link>
        </div>

        {/* Attendance List */}
        <div id="recent-classes" className="bg-brand-dark border border-brand-gray rounded-lg overflow-hidden scroll-mt-24">
          <div className="px-6 py-4 border-b border-brand-gray flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white uppercase tracking-wider">
              {filter === "month" ? "This Month's Classes" : "All Classes"}
            </h2>
            <span className="text-sm text-gray-400">
              {attendance.length} {attendance.length === 1 ? "class" : "classes"}
            </span>
          </div>

          {attendance.length > 0 ? (
            <div className="divide-y divide-brand-gray">
              {attendance.map((record) => (
                <div
                  key={record.id}
                  className="px-6 py-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-brand-teal/10 flex items-center justify-center">
                      <svg
                        className="w-5 h-5 text-brand-teal"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                    <div>
                      <p className="text-white font-medium">
                        {record.classType}
                      </p>
                      <p className="text-gray-500 text-sm">
                        {new Date(record.classDate).toLocaleDateString(
                          "en-US",
                          {
                            weekday: "short",
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          }
                        )}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-xs px-3 py-1 rounded-full font-medium ${
                      record.locationSlug === "magnolia"
                        ? "bg-blue-500/20 text-blue-400"
                        : "bg-purple-500/20 text-purple-400"
                    }`}
                  >
                    {record.locationSlug === "magnolia"
                      ? "Magnolia"
                      : "Cypress"}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center">
              <p className="text-gray-500">No attendance records yet.</p>
            </div>
          )}
        </div>
      </div>
    </MemberShell>
  );
}
