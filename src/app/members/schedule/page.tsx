import { prisma } from "@/lib/prisma";

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

export default async function MemberSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ location?: string }>;
}) {
  const params = await searchParams;
  const locationFilter = params.location || "";

  const where: Record<string, unknown> = { active: true };
  if (locationFilter) {
    where.locationSlug = locationFilter;
  }

  const schedule = await prisma.classSchedule.findMany({
    where,
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });

  // Group by day
  const grouped = DAY_NAMES.map((name, index) => ({
    day: name,
    dayIndex: index,
    classes: schedule.filter((s) => s.dayOfWeek === index),
  })).filter((g) => g.classes.length > 0);

  return (
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-white uppercase tracking-wider mb-6">
          Class Schedule
        </h1>

        {/* Location Filter */}
        <div className="flex flex-wrap gap-2 mb-8">
          {[
            { label: "All Locations", value: "" },
            { label: "Magnolia", value: "magnolia" },
            { label: "Cypress", value: "cypress" },
          ].map((loc) => {
            const isActive = locationFilter === loc.value;
            return (
              <Link
                key={loc.value}
                href={
                  loc.value
                    ? `/members/schedule?location=${loc.value}`
                    : "/members/schedule"
                }
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  isActive
                    ? "bg-brand-accent text-brand-black"
                    : "bg-brand-dark border border-brand-gray text-gray-300 hover:border-brand-accent hover:text-white"
                }`}
              >
                {loc.label}
              </Link>
            );
          })}
        </div>

        {/* Schedule by Day */}
        {grouped.length > 0 ? (
          <div className="space-y-6">
            {grouped.map((group) => (
              <div
                key={group.dayIndex}
                className="bg-brand-dark border border-brand-gray rounded-lg overflow-hidden"
              >
                <div className="bg-brand-gray/30 px-6 py-3">
                  <h2 className="text-white font-semibold uppercase tracking-wider">
                    {group.day}
                  </h2>
                </div>
                <div className="divide-y divide-brand-gray">
                  {group.classes.map((cls) => (
                    <div
                      key={cls.id}
                      className="px-6 py-4 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-4">
                        <div className="text-brand-accent font-semibold text-sm min-w-[120px]">
                          {formatTime(cls.startTime)} - {formatTime(cls.endTime)}
                        </div>
                        <div>
                          <p className="text-white font-medium capitalize">
                            {cls.classType}
                          </p>
                          <p className="text-gray-500 text-sm">
                            {cls.instructor}
                            {cls.topic && (
                              <span className="text-brand-accent/70"> · {cls.topic}</span>
                            )}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`text-xs px-3 py-1 rounded-full font-medium ${
                          cls.locationSlug === "magnolia"
                            ? "bg-blue-500/20 text-blue-400"
                            : "bg-purple-500/20 text-purple-400"
                        }`}
                      >
                        {cls.locationSlug === "magnolia"
                          ? "Magnolia"
                          : "Cypress"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-brand-dark border border-brand-gray rounded-lg p-12 text-center">
            <p className="text-gray-500">No classes scheduled.</p>
          </div>
        )}
      </div>
  );
}
