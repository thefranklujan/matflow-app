"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { formatTime } from "@/lib/utils";

interface ClassScheduleItem {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  classType: string;
  instructor: string;
  locationSlug: string;
}

interface AttendanceItem {
  id: string;
  memberId: string;
  classDate: string;
  classType: string;
  locationSlug: string;
}

interface MemberInfo {
  id: string;
  firstName: string;
  lastName: string;
  beltRank: string;
}

interface AllAttendanceItem extends AttendanceItem {
  member: MemberInfo;
}

interface CommitmentItem {
  id: string;
  memberId: string;
  classDate: string;
  classType: string;
  locationSlug: string;
  member: MemberInfo;
}

interface EventItem {
  id: string;
  title: string;
  description: string | null;
  date: string;
  endDate: string | null;
  eventType: string;
  locationSlug: string;
}

interface CalendarGridProps {
  initialSchedule: ClassScheduleItem[];
  initialAttendance: AttendanceItem[];
  initialEvents: EventItem[];
  initialAllAttendance: AllAttendanceItem[];
  initialCommitments: CommitmentItem[];
  initialMonth: number;
  initialYear: number;
  currentMemberId: string | null;
}

const DAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const CLASS_TYPE_COLORS: Record<string, string> = {
  gi: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  nogi: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  fundamentals: "bg-green-500/20 text-green-400 border-green-500/30",
  competition: "bg-red-500/20 text-red-400 border-red-500/30",
  kids: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  "self-defense": "bg-pink-500/20 text-pink-400 border-pink-500/30",
  womens: "bg-purple-500/20 text-purple-400 border-purple-500/30",
};

const EVENT_DOT_COLORS: Record<string, string> = {
  seminar: "bg-blue-400",
  "open-mat": "bg-green-400",
  promotion: "bg-yellow-400",
  closure: "bg-red-400",
  social: "bg-purple-400",
  other: "bg-gray-400",
};

const EVENT_BADGE_COLORS: Record<string, string> = {
  seminar: "bg-blue-500/20 text-blue-400",
  "open-mat": "bg-green-500/20 text-green-400",
  promotion: "bg-yellow-500/20 text-yellow-400",
  closure: "bg-red-500/20 text-red-400",
  social: "bg-purple-500/20 text-purple-400",
  other: "bg-gray-500/20 text-gray-400",
};

const BELT_COLORS: Record<string, string> = {
  white: "bg-white",
  blue: "bg-blue-600",
  purple: "bg-purple-600",
  brown: "bg-amber-800",
  black: "bg-gray-900 border border-gray-600",
};

export default function CalendarGrid({
  initialSchedule,
  initialAttendance,
  initialEvents,
  initialAllAttendance,
  initialCommitments,
  initialMonth,
  initialYear,
  currentMemberId,
}: CalendarGridProps) {
  const searchParams = useSearchParams();
  const [month, setMonth] = useState(initialMonth);
  const [year, setYear] = useState(initialYear);
  const [schedule, setSchedule] = useState(initialSchedule);
  const [attendance, setAttendance] = useState(initialAttendance);
  const [events, setEvents] = useState(initialEvents);
  const [allAttendance, setAllAttendance] = useState(initialAllAttendance);
  const [commitments, setCommitments] = useState(initialCommitments);
  const [loading, setLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [committing, setCommitting] = useState(false);

  const fetchData = useCallback(
    async (m: number, y: number) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("month", String(m));
        params.set("year", String(y));

        const location = searchParams.get("location");
        const classType = searchParams.get("classType");
        const eventType = searchParams.get("eventType");
        if (location) params.set("location", location);
        if (classType) params.set("classType", classType);
        if (eventType) params.set("eventType", eventType);

        const res = await fetch(`/api/members/calendar?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setSchedule(data.schedule);
          setAttendance(data.attendance);
          setEvents(data.events);
          setAllAttendance(data.allAttendance || []);
          setCommitments(data.commitments || []);
        }
      } finally {
        setLoading(false);
      }
    },
    [searchParams]
  );

  useEffect(() => {
    fetchData(month, year);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const goToPrevMonth = () => {
    const m = month === 1 ? 12 : month - 1;
    const y = month === 1 ? year - 1 : year;
    setMonth(m);
    setYear(y);
    setSelectedDay(null);
    fetchData(m, y);
  };

  const goToNextMonth = () => {
    const m = month === 12 ? 1 : month + 1;
    const y = month === 12 ? year + 1 : year;
    setMonth(m);
    setYear(y);
    setSelectedDay(null);
    fetchData(m, y);
  };

  const firstDayOfMonth = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month;
  const todayDate = today.getDate();

  // Lookup maps
  const attendanceByDate = new Map<string, AttendanceItem[]>();
  attendance.forEach((a) => {
    const key = new Date(a.classDate).toISOString().split("T")[0];
    if (!attendanceByDate.has(key)) attendanceByDate.set(key, []);
    attendanceByDate.get(key)!.push(a);
  });

  const allAttendanceByDate = new Map<string, AllAttendanceItem[]>();
  allAttendance.forEach((a) => {
    const key = new Date(a.classDate).toISOString().split("T")[0];
    if (!allAttendanceByDate.has(key)) allAttendanceByDate.set(key, []);
    allAttendanceByDate.get(key)!.push(a);
  });

  const commitmentsByDate = new Map<string, CommitmentItem[]>();
  commitments.forEach((c) => {
    const key = new Date(c.classDate).toISOString().split("T")[0];
    if (!commitmentsByDate.has(key)) commitmentsByDate.set(key, []);
    commitmentsByDate.get(key)!.push(c);
  });

  const eventsByDate = new Map<string, EventItem[]>();
  events.forEach((e) => {
    const key = new Date(e.date).toISOString().split("T")[0];
    if (!eventsByDate.has(key)) eventsByDate.set(key, []);
    eventsByDate.get(key)!.push(e);
  });

  const classesByDow = new Map<number, ClassScheduleItem[]>();
  schedule.forEach((s) => {
    if (!classesByDow.has(s.dayOfWeek)) classesByDow.set(s.dayOfWeek, []);
    classesByDow.get(s.dayOfWeek)!.push(s);
  });

  const getDateKey = (day: number) => new Date(year, month - 1, day).toISOString().split("T")[0];
  const getDow = (day: number) => new Date(year, month - 1, day).getDay();

  // RSVP handler
  const handleCommit = async (cls: ClassScheduleItem, dateKey: string) => {
    if (committing || !currentMemberId) return;
    setCommitting(true);
    try {
      const isCommitted = commitmentsByDate.get(dateKey)?.some(
        (c) => c.memberId === currentMemberId && c.classType === cls.classType
      );

      if (isCommitted) {
        await fetch("/api/members/calendar/commit", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ classDate: dateKey, classType: cls.classType }),
        });
      } else {
        await fetch("/api/members/calendar/commit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            classDate: dateKey,
            classType: cls.classType,
            locationSlug: cls.locationSlug,
          }),
        });
      }
      await fetchData(month, year);
    } finally {
      setCommitting(false);
    }
  };

  // Selected day data
  const selectedDateKey = selectedDay ? getDateKey(selectedDay) : null;
  const selectedDow = selectedDay ? getDow(selectedDay) : null;
  const selectedDayAttendance = selectedDateKey ? attendanceByDate.get(selectedDateKey) || [] : [];
  const _selectedDayAllAttendance = selectedDateKey ? allAttendanceByDate.get(selectedDateKey) || [] : [];
  const selectedDayCommitments = selectedDateKey ? commitmentsByDate.get(selectedDateKey) || [] : [];
  const selectedDayEvents = selectedDateKey ? eventsByDate.get(selectedDateKey) || [] : [];
  const selectedDayClasses = selectedDow !== null ? classesByDow.get(selectedDow) || [] : [];

  const isPastDate = (day: number) => {
    const d = new Date(year, month - 1, day);
    d.setHours(23, 59, 59, 999);
    return d < today;
  };

  const formatSelectedDate = (day: number) =>
    new Date(year, month - 1, day).toLocaleDateString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });

  // Get unique members who attended or committed to a specific class type on a date
  const getMembersForClass = (dateKey: string, classType: string) => {
    const attended = (allAttendanceByDate.get(dateKey) || [])
      .filter((a) => a.classType === classType)
      .map((a) => ({ ...a.member, status: "attended" as const }));
    const committed = (commitmentsByDate.get(dateKey) || [])
      .filter((c) => c.classType === classType && !attended.some((a) => a.id === c.member.id))
      .map((c) => ({ ...c.member, status: "committed" as const }));
    return [...attended, ...committed];
  };

  return (
    <div>
      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={goToPrevMonth} className="p-2 rounded-lg bg-brand-dark border border-brand-gray text-gray-300 hover:border-brand-teal hover:text-white transition" aria-label="Previous month">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <h2 className="text-lg font-semibold text-white">{MONTH_NAMES[month - 1]} {year}</h2>
        <button onClick={goToNextMonth} className="p-2 rounded-lg bg-brand-dark border border-brand-gray text-gray-300 hover:border-brand-teal hover:text-white transition" aria-label="Next month">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="bg-brand-dark border border-brand-gray rounded-lg overflow-hidden">
        <div className="grid grid-cols-7 border-b border-brand-gray">
          {DAY_HEADERS.map((d) => (
            <div key={d} className="py-2 text-center text-xs uppercase text-gray-400 font-medium">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {Array.from({ length: firstDayOfMonth }).map((_, i) => (
            <div key={`empty-start-${i}`} className="border-b border-r border-brand-gray bg-brand-black/30 min-h-[56px] md:min-h-[90px]" />
          ))}

          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dateKey = getDateKey(day);
            const dow = getDow(day);
            const isToday = isCurrentMonth && day === todayDate;
            const isSelected = selectedDay === day;
            const dayAttendance = attendanceByDate.get(dateKey) || [];
            const dayEvents = eventsByDate.get(dateKey) || [];
            const dayClasses = classesByDow.get(dow) || [];
            const dayCommitments = commitmentsByDate.get(dateKey) || [];
            const dayAllAttendance = allAttendanceByDate.get(dateKey) || [];

            // Count unique members for the day
            const uniqueMembers = new Set([
              ...dayAllAttendance.map((a) => a.memberId),
              ...dayCommitments.map((c) => c.memberId),
            ]);

            return (
              <button
                key={day}
                onClick={() => setSelectedDay(day === selectedDay ? null : day)}
                className={`relative border-b border-r border-brand-gray min-h-[56px] md:min-h-[90px] p-1 md:p-1.5 text-left transition hover:bg-brand-gray/20 ${
                  isSelected ? "bg-brand-gray/30" : ""
                } ${isToday ? "ring-1 ring-inset ring-brand-teal" : ""}`}
              >
                <span className={`text-xs md:text-sm ${isToday ? "text-white font-bold" : "text-gray-400"}`}>
                  {day}
                </span>

                {/* Bubbles - class type pills on desktop */}
                <div className="hidden md:flex flex-wrap gap-0.5 mt-0.5">
                  {dayClasses.slice(0, 3).map((cls) => {
                    const myAttended = dayAttendance.some((a) => a.classType === cls.classType);
                    return (
                      <span
                        key={cls.id}
                        className={`text-[8px] px-1 py-px rounded border leading-tight ${
                          myAttended
                            ? "bg-brand-teal/20 text-brand-teal border-brand-teal/40"
                            : CLASS_TYPE_COLORS[cls.classType] || "bg-gray-500/20 text-gray-400 border-gray-500/30"
                        }`}
                      >
                        {cls.classType === "fundamentals" ? "fund" : cls.classType === "competition" ? "comp" : cls.classType}
                      </span>
                    );
                  })}
                  {dayClasses.length > 3 && (
                    <span className="text-[8px] text-gray-500">+{dayClasses.length - 3}</span>
                  )}
                </div>

                {/* Mobile: compact dots */}
                <div className="flex md:hidden flex-wrap gap-0.5 mt-0.5">
                  {dayAttendance.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-brand-teal" />}
                  {dayEvents.map((evt) => (
                    <span key={evt.id} className={`w-1.5 h-1.5 rounded-full ${EVENT_DOT_COLORS[evt.eventType] || "bg-gray-400"}`} />
                  ))}
                </div>

                {/* Event bubbles on desktop */}
                {dayEvents.slice(0, 2).map((evt) => (
                  <div key={evt.id} className="hidden md:block text-[7px] mt-0.5 px-1 py-px rounded truncate max-w-full leading-tight"
                    style={{ color: evt.eventType === "closure" ? "#f87171" : "#c084fc" }}>
                    {evt.title.length > 12 ? evt.title.slice(0, 12) + "…" : evt.title}
                  </div>
                ))}

                {/* Members count bubble */}
                {uniqueMembers.size > 0 && (
                  <div className="hidden md:flex items-center gap-0.5 mt-0.5">
                    <svg className="w-2.5 h-2.5 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
                    </svg>
                    <span className="text-[8px] text-gray-500">{uniqueMembers.size}</span>
                  </div>
                )}
              </button>
            );
          })}

          {(() => {
            const lastDayDow = new Date(year, month - 1, daysInMonth).getDay();
            const trailing = lastDayDow === 6 ? 0 : 6 - lastDayDow;
            return Array.from({ length: trailing }).map((_, i) => (
              <div key={`empty-end-${i}`} className="border-b border-r border-brand-gray bg-brand-black/30 min-h-[56px] md:min-h-[90px]" />
            ));
          })()}
        </div>
      </div>

      {loading && (
        <div className="text-center py-4"><span className="text-gray-400 text-sm">Loading...</span></div>
      )}

      {/* Day Detail Panel */}
      {selectedDay && selectedDateKey && (
        <div className="mt-6 bg-brand-dark border border-brand-gray rounded-lg overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-brand-gray">
            <h3 className="text-white font-semibold">{formatSelectedDate(selectedDay)}</h3>
          </div>

          <div className="p-4 sm:p-6 space-y-6">
            {/* Classes */}
            <div>
              <h4 className="text-sm text-gray-400 uppercase tracking-wider font-medium mb-3">Classes</h4>
              {selectedDayClasses.length > 0 ? (
                <div className="space-y-3">
                  {selectedDayClasses.map((cls) => {
                    const myAttended = selectedDayAttendance.some((a) => a.classType === cls.classType);
                    const members = getMembersForClass(selectedDateKey, cls.classType);
                    const isCommitted = selectedDayCommitments.some(
                      (c) => c.memberId === currentMemberId && c.classType === cls.classType
                    );
                    const past = isPastDate(selectedDay);

                    return (
                      <div key={cls.id} className="rounded-lg bg-brand-black/40 overflow-hidden">
                        {/* Class header */}
                        <div className="flex items-center justify-between py-3 px-4">
                          <div className="flex items-center gap-3">
                            {myAttended ? (
                              <div className="w-6 h-6 rounded-full bg-brand-teal/20 flex items-center justify-center flex-shrink-0">
                                <svg className="w-4 h-4 text-brand-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                            ) : (
                              <div className="w-6 h-6 rounded-full border border-brand-gray flex-shrink-0" />
                            )}
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${CLASS_TYPE_COLORS[cls.classType] || "bg-gray-500/20 text-gray-400 border-gray-500/30"}`}>
                                  {cls.classType}
                                </span>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${cls.locationSlug === "magnolia" ? "bg-blue-500/20 text-blue-400" : "bg-purple-500/20 text-purple-400"}`}>
                                  {cls.locationSlug === "magnolia" ? "Magnolia" : "Cypress"}
                                </span>
                              </div>
                              <p className="text-gray-500 text-xs mt-1">{cls.instructor} &middot; {formatTime(cls.startTime)} - {formatTime(cls.endTime)}</p>
                            </div>
                          </div>

                          {/* RSVP button (only for future dates) */}
                          {!past && !myAttended && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleCommit(cls, selectedDateKey); }}
                              disabled={committing}
                              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition ${
                                isCommitted
                                  ? "bg-brand-teal/20 text-brand-teal border border-brand-teal/40 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/40"
                                  : "bg-brand-gray/50 text-gray-300 border border-brand-gray hover:bg-brand-teal/20 hover:text-brand-teal hover:border-brand-teal/40"
                              }`}
                            >
                              {isCommitted ? "Going ✓" : "I'm Going"}
                            </button>
                          )}
                        </div>

                        {/* Members who attended/committed */}
                        {members.length > 0 && (
                          <div className="px-4 pb-3 pt-0">
                            <div className="flex flex-wrap gap-1.5">
                              {members.slice(0, 12).map((m) => (
                                <div
                                  key={m.id}
                                  className={`flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-full ${
                                    m.status === "attended"
                                      ? "bg-brand-teal/10 text-brand-teal"
                                      : "bg-brand-gray/40 text-gray-400"
                                  } ${m.id === currentMemberId ? "ring-1 ring-brand-teal/50" : ""}`}
                                >
                                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${BELT_COLORS[m.beltRank] || "bg-white"}`} />
                                  {m.firstName} {m.lastName.charAt(0)}.
                                  {m.status === "committed" && (
                                    <span className="text-[9px] text-gray-500">(planned)</span>
                                  )}
                                </div>
                              ))}
                              {members.length > 12 && (
                                <span className="text-[11px] text-gray-500 px-2 py-1">+{members.length - 12} more</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No classes scheduled for this day.</p>
              )}
            </div>

            {/* Events */}
            {selectedDayEvents.length > 0 && (
              <div>
                <h4 className="text-sm text-gray-400 uppercase tracking-wider font-medium mb-3">Events</h4>
                <div className="space-y-2">
                  {selectedDayEvents.map((evt) => (
                    <div key={evt.id} className="py-2 px-3 rounded-lg bg-brand-black/40">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-white text-sm font-medium">{evt.title}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${EVENT_BADGE_COLORS[evt.eventType] || "bg-gray-500/20 text-gray-400"}`}>
                          {evt.eventType}
                        </span>
                      </div>
                      {evt.description && <p className="text-gray-400 text-xs">{evt.description}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedDayClasses.length === 0 && selectedDayEvents.length === 0 && (
              <p className="text-gray-500 text-sm text-center py-4">Nothing scheduled for this day.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
