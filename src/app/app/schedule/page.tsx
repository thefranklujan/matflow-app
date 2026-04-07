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
            <div className="grid grid-cols-7 gap-1">
              {calendarCells.map((date, i) => {
                if (!date) return <div key={i} />;
                const classCount = classesForDate(date).length;
                const isToday = isSameDay(date, today);
                const isSelected = isSameDay(date, selectedDate);
                return (
                  <button
                    key={i}
                    onClick={() => setSelectedDate(date)}
                    className={`aspect-square rounded-lg flex flex-col items-center justify-center text-sm transition border ${
                      isSelected
                        ? "bg-brand-accent/20 border-brand-accent text-white"
                        : isToday
                        ? "bg-white/5 border-white/20 text-white"
                        : "border-transparent text-gray-300 hover:bg-white/5"
                    }`}
                  >
                    <span className={isToday ? "font-bold" : ""}>{date.getDate()}</span>
                    {classCount > 0 && (
                      <span className="mt-0.5 h-1 w-1 rounded-full bg-brand-accent" />
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
                {selectedClasses.map((c) => (
                  <div key={c.id} className="border-l-2 border-brand-accent pl-3 py-1">
                    <p className="text-brand-accent text-sm font-semibold">
                      {formatTime(c.startTime)} – {formatTime(c.endTime)}
                    </p>
                    <p className="text-white text-sm">{classLabel(c.classType)}{c.topic ? ` · ${c.topic}` : ""}</p>
                    <p className="text-gray-500 text-xs">{c.instructor}</p>
                    {isAdmin && (
                      <button onClick={() => handleDelete(c.id)} className="text-red-400 text-xs mt-1 hover:underline">
                        Delete
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
