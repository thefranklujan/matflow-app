"use client";

import { useState, useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CLASS_TYPES, DAYS_OF_WEEK, SCHEDULE_TOPICS } from "@/lib/constants";
import { formatTime } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

interface ScheduleEntry {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  classType: string;
  instructor: string;
  topic: string | null;
  active: boolean;
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
  const key = classType.toLowerCase().replace(/[\s-]/g, (m) => (m === "-" ? "-" : ""));
  // Map common variants
  const normalized = key === "no-gi" ? "nogi" : key === "open mat" || key === "openmat" ? "openmat" : key;
  return CLASS_COLORS[normalized] || CLASS_COLORS.default;
}

export default function SchedulePage() {
  const { isAdmin } = useAuth();
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());

  // Admin form state
  const [showForm, setShowForm] = useState(false);
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [classType, setClassType] = useState<string>(CLASS_TYPES[0].value);
  const [instructor, setInstructor] = useState("");
  const [topic, setTopic] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadSchedule();
  }, []);

  async function loadSchedule() {
    setLoading(true);
    const res = await fetch("/api/admin/schedule");
    if (res.ok) setEntries(await res.json());
    setLoading(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const res = await fetch("/api/admin/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dayOfWeek, startTime, endTime, classType, instructor, topic: topic || null }),
    });
    if (res.ok) {
      setInstructor("");
      setTopic("");
      setShowForm(false);
      loadSchedule();
    }
    setSubmitting(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this schedule entry?")) return;
    await fetch(`/api/admin/schedule/${id}`, { method: "DELETE" });
    loadSchedule();
  }

  function classLabel(value: string) {
    return CLASS_TYPES.find((c) => c.value === value)?.label ?? value;
  }

  // Build calendar grid for cursor month
  const calendarCells = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const firstDay = new Date(year, month, 1);
    const startWeekday = firstDay.getDay();
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
    return entries
      .filter((e) => e.dayOfWeek === date.getDay() && e.active)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }

  const selectedClasses = classesForDate(selectedDate);
  const monthLabel = cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  // Build legend from class types actually used in the schedule
  const legendTypes = Array.from(new Set(entries.map((e) => e.classType)))
    .map((ct) => ({ classType: ct, ...colorFor(ct), display: classLabel(ct) }));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Class Schedule</h1>
        {isAdmin && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-brand-accent text-brand-black font-bold px-4 py-2 rounded-lg hover:bg-brand-accent/90 transition text-sm"
          >
            {showForm ? "Cancel" : "+ Add Class"}
          </button>
        )}
      </div>

      {isAdmin && showForm && (
        <div className="bg-brand-dark border border-brand-gray rounded-lg p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">New Schedule Entry</h2>
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Day</label>
              <select value={dayOfWeek} onChange={(e) => setDayOfWeek(Number(e.target.value))} className="w-full bg-brand-gray border border-brand-gray rounded-lg px-3 py-2 text-white text-sm">
                {DAYS_OF_WEEK.map((day, i) => (<option key={i} value={i}>{day}</option>))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Start Time</label>
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required className="w-full bg-brand-gray border border-brand-gray rounded-lg px-3 py-2 text-white text-sm" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">End Time</label>
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required className="w-full bg-brand-gray border border-brand-gray rounded-lg px-3 py-2 text-white text-sm" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Class Type</label>
              <select value={classType} onChange={(e) => setClassType(e.target.value)} className="w-full bg-brand-gray border border-brand-gray rounded-lg px-3 py-2 text-white text-sm">
                {CLASS_TYPES.map((ct) => (<option key={ct.value} value={ct.value}>{ct.label}</option>))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Instructor</label>
              <input type="text" value={instructor} onChange={(e) => setInstructor(e.target.value)} required className="w-full bg-brand-gray border border-brand-gray rounded-lg px-3 py-2 text-white text-sm" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Topic (Optional)</label>
              <select value={topic} onChange={(e) => setTopic(e.target.value)} className="w-full bg-brand-gray border border-brand-gray rounded-lg px-3 py-2 text-white text-sm">
                <option value="">No Topic</option>
                {SCHEDULE_TOPICS.map((t) => (<option key={t} value={t}>{t}</option>))}
              </select>
            </div>
            <div className="md:col-span-3">
              <button type="submit" disabled={submitting} className="bg-brand-accent text-brand-black font-bold px-4 py-2 rounded-lg hover:bg-brand-accent/90 transition text-sm disabled:opacity-50">
                {submitting ? "Adding..." : "Add to Schedule"}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">Loading schedule...</p>
      ) : (
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
            <div className="grid grid-cols-7 gap-1 mb-2">
              {DAY_INITIALS.map((d, i) => (
                <div key={i} className="text-center text-xs text-gray-500 font-semibold py-1">{d}</div>
              ))}
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
            <div className="grid grid-cols-7 gap-1">
              {calendarCells.map((date, i) => {
                if (!date) return <div key={i} />;
                const dayClasses = classesForDate(date);
                const isToday = isSameDay(date, today);
                const isSelected = isSameDay(date, selectedDate);
                // De-duplicate class type colors so each cell shows a palette, not duplicates
                const uniqueColors = Array.from(
                  new Set(dayClasses.map((c) => colorFor(c.classType).bar))
                ).slice(0, 4);
                return (
                  <button
                    key={i}
                    onClick={() => setSelectedDate(date)}
                    className={`aspect-square rounded-lg flex flex-col items-center justify-center text-sm transition border ${
                      isSelected
                        ? "bg-brand-accent/20 border-brand-accent text-white"
                        : isToday
                        ? "bg-white/5 border-white/30 text-white"
                        : dayClasses.length > 0
                        ? "border-white/5 text-white hover:bg-white/5"
                        : "border-transparent text-gray-500 hover:bg-white/5"
                    }`}
                  >
                    <span className={isToday ? "font-bold" : ""}>{date.getDate()}</span>
                    {uniqueColors.length > 0 && (
                      <span className="mt-1 flex items-center gap-0.5">
                        {uniqueColors.map((bar, idx) => (
                          <span key={idx} className={`h-1.5 w-1.5 rounded-full ${bar}`} />
                        ))}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected day classes */}
          <div className="bg-brand-dark border border-brand-gray rounded-lg p-6">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-1">
              {selectedDate.toLocaleDateString("en-US", { weekday: "long" })}
            </h2>
            <p className="text-white text-lg font-bold mb-4">
              {selectedDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </p>
            {selectedClasses.length === 0 ? (
              <p className="text-gray-500 text-sm">No classes scheduled.</p>
            ) : (
              <div className="space-y-3">
                {selectedClasses.map((c) => {
                  const color = colorFor(c.classType);
                  return (
                    <div key={c.id} className={`rounded-lg p-3 ${color.bg} border-l-4`} style={{ borderLeftColor: "currentColor" }}>
                      <div className={color.text}>
                        <p className="text-sm font-semibold">{formatTime(c.startTime)} – {formatTime(c.endTime)}</p>
                      </div>
                      <p className="text-white text-sm font-medium mt-0.5">{classLabel(c.classType)}{c.topic ? ` · ${c.topic}` : ""}</p>
                      <p className="text-gray-500 text-xs">{c.instructor}</p>
                      {isAdmin && (
                        <button onClick={() => handleDelete(c.id)} className="text-red-400 text-xs mt-1 hover:underline">
                          Delete
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
