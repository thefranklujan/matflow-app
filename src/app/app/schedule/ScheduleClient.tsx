"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Check, Trash2 } from "lucide-react";
import { CLASS_TYPES, DAYS_OF_WEEK, SCHEDULE_TOPICS } from "@/lib/constants";
import { formatTime } from "@/lib/utils";

interface ScheduleItem {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  classType: string;
  instructor: string;
  topic: string | null;
  locationSlug: string;
}

interface VideoItem {
  id: string;
  title: string;
  description: string | null;
  embedUrl: string;
  classType: string;
}

interface Attendee {
  classDate: string;
  classType: string;
  firstName: string;
  lastName: string;
  beltRank: string;
}

interface EventItem {
  id: string;
  title: string;
  description: string | null;
  date: string;
  endDate: string | null;
  eventType: string;
}

interface Commitment {
  id?: string;
  classDate: string;
  classType: string;
  locationSlug: string;
}

const DAY_INITIALS = ["S", "M", "T", "W", "T", "F", "S"];

const CLASS_COLORS: Record<string, { bg: string; bar: string; text: string; label: string }> = {
  gi:           { bg: "bg-blue-500/15",   bar: "bg-blue-500",   text: "text-blue-300",   label: "Gi" },
  nogi:         { bg: "bg-red-500/15",    bar: "bg-red-500",    text: "text-red-300",    label: "No-Gi" },
  kids:         { bg: "bg-yellow-500/15", bar: "bg-yellow-500", text: "text-yellow-300", label: "Kids" },
  fundamentals: { bg: "bg-green-500/15",  bar: "bg-green-500",  text: "text-green-300",  label: "Fundamentals" },
  competition:  { bg: "bg-purple-500/15", bar: "bg-purple-500", text: "text-purple-300", label: "Competition" },
  womens:       { bg: "bg-pink-500/15",   bar: "bg-pink-500",   text: "text-pink-300",   label: "Women's" },
  "self-defense": { bg: "bg-orange-500/15", bar: "bg-orange-500", text: "text-orange-300", label: "Self-Defense" },
  openmat:      { bg: "bg-cyan-500/15",   bar: "bg-cyan-500",   text: "text-cyan-300",   label: "Open Mat" },
  default:      { bg: "bg-white/5",       bar: "bg-gray-400",   text: "text-gray-300",   label: "Other" },
};

function colorFor(classType: string) {
  const key = classType.toLowerCase().replace(/\s/g, "");
  const normalized = key === "no-gi" ? "nogi" : key === "openmat" ? "openmat" : key;
  return CLASS_COLORS[normalized] || CLASS_COLORS.default;
}

function classLabel(value: string) {
  return CLASS_TYPES.find((c) => c.value === value)?.label ?? value;
}

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function ScheduleClient({
  schedule: initialSchedule,
  initialCommitments,
  attendees = [],
  events = [],
  videos: _videos = [],
  isAdmin,
}: {
  schedule: ScheduleItem[];
  initialCommitments: Commitment[];
  attendees?: Attendee[];
  events?: EventItem[];
  videos?: VideoItem[];
  isAdmin: boolean;
}) {
  void _videos;
  const [, setOpenClass] = useState<{ date: Date; classItem: ScheduleItem } | null>(null);
  const [schedule, setSchedule] = useState<ScheduleItem[]>(initialSchedule);
  const [commitments, setCommitments] = useState<Commitment[]>(initialCommitments);
  const [showAdminForm, setShowAdminForm] = useState(false);
  const [adminDay, setAdminDay] = useState(1);
  const [adminStart, setAdminStart] = useState("09:00");
  const [adminEnd, setAdminEnd] = useState("10:00");
  const [adminClassType, setAdminClassType] = useState<string>(CLASS_TYPES[0].value);
  const [adminInstructor, setAdminInstructor] = useState("");
  const [adminTopic, setAdminTopic] = useState("");
  const [adminSubmitting, setAdminSubmitting] = useState(false);

  async function reloadSchedule() {
    const res = await fetch("/api/admin/schedule");
    if (res.ok) {
      const data = await res.json();
      setSchedule(data);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setAdminSubmitting(true);
    const res = await fetch("/api/admin/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dayOfWeek: adminDay,
        startTime: adminStart,
        endTime: adminEnd,
        classType: adminClassType,
        instructor: adminInstructor,
        topic: adminTopic || null,
      }),
    });
    if (res.ok) {
      setAdminInstructor("");
      setAdminTopic("");
      setShowAdminForm(false);
      await reloadSchedule();
    }
    setAdminSubmitting(false);
  }

  async function handleDeleteEntry(id: string) {
    if (!confirm("Delete this schedule entry?")) return;
    await fetch(`/api/admin/schedule/${id}`, { method: "DELETE" });
    await reloadSchedule();
  }

  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [busy, setBusy] = useState<string | null>(null);

  const calendarCells = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const startWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [cursor]);

  const today = new Date();
  function isSameDay(a: Date, b: Date) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }
  function classesForDate(date: Date) {
    return schedule
      .filter((e) => e.dayOfWeek === date.getDay())
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }
  function attendeesFor(date: Date, classItem: ScheduleItem) {
    const k = dateKey(date);
    const ck = commitKey(classItem);
    return attendees.filter((a) => a.classDate.slice(0, 10) === k && a.classType === ck);
  }
  function eventsForDate(date: Date) {
    return events.filter((ev) => {
      const start = new Date(ev.date);
      const end = ev.endDate ? new Date(ev.endDate) : start;
      const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
      const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      return target >= startDay && target <= endDay;
    });
  }
  // Scope commitments by class start time so two same-type classes on the same day
  // (e.g. 7am Gi and 6pm Gi) are tracked independently.
  function commitKey(classItem: ScheduleItem) {
    return `${classItem.classType}@${classItem.startTime}`;
  }
  function isCommitted(date: Date, classItem: ScheduleItem) {
    const k = dateKey(date);
    const ck = commitKey(classItem);
    return commitments.some((c) => c.classDate.slice(0, 10) === k && c.classType === ck);
  }

  async function toggleCommit(date: Date, classItem: ScheduleItem) {
    const k = dateKey(date);
    const ck = commitKey(classItem);
    const rowKey = `${k}-${ck}`;
    if (busy === rowKey) return;
    setBusy(rowKey);
    const committed = isCommitted(date, classItem);
    const body = JSON.stringify({
      classDate: new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString(),
      classType: ck,
      locationSlug: classItem.locationSlug,
    });
    try {
      const res = await fetch("/api/members/calendar/commit", {
        method: committed ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      if (res.ok) {
        if (committed) {
          setCommitments((prev) =>
            prev.filter((c) => !(c.classDate.slice(0, 10) === k && c.classType === ck))
          );
        } else {
          setCommitments((prev) => [
            ...prev,
            { classDate: new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString(), classType: ck, locationSlug: classItem.locationSlug },
          ]);
        }
      }
    } finally {
      setBusy(null);
    }
  }

  const monthLabel = cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const selectedClasses = classesForDate(selectedDate);
  const selectedEvents = eventsForDate(selectedDate);
  // Dedupe by the resolved color label so case/whitespace variants ("Gi" vs "gi") collapse
  const legendMap = new Map<string, { classType: string; bar: string; display: string }>();
  for (const e of schedule) {
    const c = colorFor(e.classType);
    if (!legendMap.has(c.label)) {
      legendMap.set(c.label, { classType: e.classType, bar: c.bar, display: c.label });
    }
  }
  const legendTypes = Array.from(legendMap.values());

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Schedule</h1>
        {isAdmin && (
          <button
            onClick={() => setShowAdminForm(!showAdminForm)}
            className="bg-brand-accent text-brand-black font-bold px-4 py-2 rounded-lg hover:bg-brand-accent/90 transition text-sm"
          >
            {showAdminForm ? "Cancel" : "+ Add Class"}
          </button>
        )}
      </div>

      {isAdmin && showAdminForm && (
        <div className="bg-brand-dark border border-brand-gray rounded-lg p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">New Schedule Entry</h2>
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Day</label>
              <select value={adminDay} onChange={(e) => setAdminDay(Number(e.target.value))} className="w-full bg-brand-gray border border-brand-gray rounded-lg px-3 py-2 text-white text-sm">
                {DAYS_OF_WEEK.map((day, i) => (<option key={i} value={i}>{day}</option>))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Start Time</label>
              <input type="time" value={adminStart} onChange={(e) => setAdminStart(e.target.value)} required className="w-full bg-brand-gray border border-brand-gray rounded-lg px-3 py-2 text-white text-sm" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">End Time</label>
              <input type="time" value={adminEnd} onChange={(e) => setAdminEnd(e.target.value)} required className="w-full bg-brand-gray border border-brand-gray rounded-lg px-3 py-2 text-white text-sm" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Class Type</label>
              <select value={adminClassType} onChange={(e) => setAdminClassType(e.target.value)} className="w-full bg-brand-gray border border-brand-gray rounded-lg px-3 py-2 text-white text-sm">
                {CLASS_TYPES.map((ct) => (<option key={ct.value} value={ct.value}>{ct.label}</option>))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Instructor</label>
              <input type="text" value={adminInstructor} onChange={(e) => setAdminInstructor(e.target.value)} required className="w-full bg-brand-gray border border-brand-gray rounded-lg px-3 py-2 text-white text-sm" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Topic (Optional)</label>
              <select value={adminTopic} onChange={(e) => setAdminTopic(e.target.value)} className="w-full bg-brand-gray border border-brand-gray rounded-lg px-3 py-2 text-white text-sm">
                <option value="">No Topic</option>
                {SCHEDULE_TOPICS.map((t) => (<option key={t} value={t}>{t}</option>))}
              </select>
            </div>
            <div className="md:col-span-3">
              <button type="submit" disabled={adminSubmitting} className="bg-brand-accent text-brand-black font-bold px-4 py-2 rounded-lg hover:bg-brand-accent/90 transition text-sm disabled:opacity-50">
                {adminSubmitting ? "Adding..." : "Add to Schedule"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-2 bg-brand-dark border border-brand-gray rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
              className="p-1.5 rounded hover:bg-white/5 text-gray-400 hover:text-white"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <h2 className="text-lg font-bold text-white">{monthLabel}</h2>
            <button
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
              className="p-1.5 rounded hover:bg-white/5 text-gray-400 hover:text-white"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          {legendTypes.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4 pb-4 border-b border-white/5">
              {legendTypes.map((t) => (
                <div key={t.classType} className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${t.bar}`} />
                  <span className="text-xs text-gray-300">{t.display}</span>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-7 gap-1 mb-2">
            {DAY_INITIALS.map((d, i) => (
              <div key={i} className="text-center text-xs text-gray-500 font-semibold py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {calendarCells.map((date, i) => {
              if (!date) return <div key={i} />;
              const dayClasses = classesForDate(date);
              const dayEvents = eventsForDate(date);
              const isToday = isSameDay(date, today);
              const isSelected = isSameDay(date, selectedDate);
              const uniqueColors = Array.from(new Set(dayClasses.map((c) => colorFor(c.classType).bar))).slice(0, 4);
              const hasCommitment = dayClasses.some((c) => isCommitted(date, c));
              return (
                <button
                  key={i}
                  onClick={() => setSelectedDate(date)}
                  className={`relative aspect-square rounded-lg flex flex-col items-center justify-center text-sm transition border ${
                    isSelected
                      ? "bg-brand-accent/20 border-brand-accent text-white"
                      : isToday
                      ? "bg-white/5 border-white/30 text-white"
                      : dayClasses.length > 0 || dayEvents.length > 0
                      ? "border-white/5 text-white hover:bg-white/5"
                      : "border-transparent text-gray-500 hover:bg-white/5"
                  }`}
                >
                  <span className={isToday ? "font-bold" : ""}>{date.getDate()}</span>
                  {dayEvents.length > 0 && (
                    <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-amber-400" />
                  )}
                  {uniqueColors.length > 0 && (
                    <span className="mt-1 flex items-center gap-0.5">
                      {uniqueColors.map((bar, idx) => (
                        <span key={idx} className={`h-1.5 w-1.5 rounded-full ${bar}`} />
                      ))}
                    </span>
                  )}
                  {hasCommitment && <Check className="h-3 w-3 text-green-400 mt-0.5" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Day detail */}
        <div className="bg-brand-dark border border-brand-gray rounded-lg p-6">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-1">
            {selectedDate.toLocaleDateString("en-US", { weekday: "long" })}
          </h2>
          <p className="text-white text-lg font-bold mb-4">
            {selectedDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </p>
          {selectedEvents.length > 0 && (
            <div className="mb-4 space-y-2">
              <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider">Events</h3>
              {selectedEvents.map((ev) => (
                <div key={ev.id} className="rounded-lg p-3 bg-amber-500/10 border-l-4 border-amber-400">
                  <p className="text-white text-sm font-semibold">{ev.title}</p>
                  <p className="text-amber-300 text-xs uppercase tracking-wider mt-0.5">{ev.eventType}</p>
                  {ev.description && <p className="text-gray-400 text-xs mt-1">{ev.description}</p>}
                </div>
              ))}
            </div>
          )}
          {selectedClasses.length === 0 && selectedEvents.length === 0 ? (
            <p className="text-gray-500 text-sm">No classes scheduled.</p>
          ) : selectedClasses.length === 0 ? null : (
            <div className="space-y-3">
              {selectedClasses.map((c) => {
                const color = colorFor(c.classType);
                const committed = isCommitted(selectedDate, c);
                const going = attendeesFor(selectedDate, c);
                return (
                  <div
                    key={c.id}
                    onClick={() => setOpenClass({ date: selectedDate, classItem: c })}
                    className={`rounded-lg p-3 ${color.bg} border-l-4 cursor-pointer hover:brightness-125 transition`}
                    style={{ borderLeftColor: "currentColor" }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className={color.text}>
                          <p className="text-sm font-semibold">{formatTime(c.startTime)} – {formatTime(c.endTime)}</p>
                        </div>
                        <p className="text-white text-sm font-medium mt-0.5">{classLabel(c.classType)}{c.topic ? ` · ${c.topic}` : ""}</p>
                        <p className="text-gray-500 text-xs">{c.instructor}</p>
                        {going.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-white/5">
                            <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1">{going.length} going</p>
                            <div className="flex flex-wrap gap-1">
                              {going.slice(0, 8).map((a, idx) => (
                                <span key={idx} className="text-[11px] bg-white/5 text-gray-300 px-1.5 py-0.5 rounded">
                                  {a.firstName} {a.lastName.slice(0, 1)}.
                                </span>
                              ))}
                              {going.length > 8 && (
                                <span className="text-[11px] text-gray-500 px-1.5 py-0.5">+{going.length - 8} more</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      {isAdmin ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteEntry(c.id); }}
                          className="shrink-0 h-7 w-7 rounded-md flex items-center justify-center border border-red-500/30 text-red-400 hover:bg-red-500/10 transition"
                          title="Delete class"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleCommit(selectedDate, c); }}
                          disabled={busy === `${dateKey(selectedDate)}-${commitKey(c)}`}
                          className={`shrink-0 h-7 w-7 rounded-md flex items-center justify-center border transition ${
                            committed
                              ? "bg-green-500 border-green-500 text-white"
                              : "border-white/20 text-gray-400 hover:border-white/40 hover:text-white"
                          } disabled:opacity-50`}
                          title={committed ? "Going — click to remove" : "Mark as going"}
                        >
                          <Check className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
