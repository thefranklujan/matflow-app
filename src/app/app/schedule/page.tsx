"use client";

import { useState, useEffect } from "react";

import { CLASS_TYPES, DAYS_OF_WEEK, SCHEDULE_TOPICS } from "@/lib/constants";

// TODO: Locations will come from the Gym model
const LOCATIONS: { value: string; label: string }[] = [];
import { formatTime } from "@/lib/utils";

interface ScheduleEntry {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  classType: string;
  instructor: string;
  locationSlug: string;
  topic: string | null;
  active: boolean;
}

export default function AdminSchedulePage() {
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // New entry form
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [classType, setClassType] = useState<string>(CLASS_TYPES[0].value);
  const [instructor, setInstructor] = useState("");
  const [locationSlug, setLocationSlug] = useState<string>(LOCATIONS[0]?.value ?? "");
  const [topic, setTopic] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    loadSchedule();
  }, []);

  async function loadSchedule() {
    setLoading(true);
    const res = await fetch("/api/admin/schedule");
    if (res.ok) {
      setEntries(await res.json());
    }
    setLoading(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    const res = await fetch("/api/admin/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dayOfWeek,
        startTime,
        endTime,
        classType,
        instructor,
        locationSlug,
        topic: topic || null,
      }),
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

  function locLabel(value: string) {
    return LOCATIONS.find((l) => l.value === value)?.label ?? value;
  }

  // Group entries by day
  const grouped: Record<number, ScheduleEntry[]> = {};
  entries.forEach((entry) => {
    if (!grouped[entry.dayOfWeek]) grouped[entry.dayOfWeek] = [];
    grouped[entry.dayOfWeek].push(entry);
  });

  return (
      <div>
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-white">Class Schedule</h1>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-brand-accent text-brand-black font-bold px-4 py-2 rounded-lg hover:bg-brand-accent/90 transition text-sm"
          >
            {showForm ? "Cancel" : "+ Add Class"}
          </button>
        </div>

        {showForm && (
          <div className="bg-brand-dark border border-brand-gray rounded-lg p-6 mb-6">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
              New Schedule Entry
            </h2>
            <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Day</label>
                <select
                  value={dayOfWeek}
                  onChange={(e) => setDayOfWeek(Number(e.target.value))}
                  className="w-full bg-brand-gray border border-brand-gray rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-accent"
                >
                  {DAYS_OF_WEEK.map((day, i) => (
                    <option key={i} value={i}>
                      {day}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Start Time</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                  className="w-full bg-brand-gray border border-brand-gray rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-accent"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">End Time</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  required
                  className="w-full bg-brand-gray border border-brand-gray rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-accent"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Class Type</label>
                <select
                  value={classType}
                  onChange={(e) => setClassType(e.target.value)}
                  className="w-full bg-brand-gray border border-brand-gray rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-accent"
                >
                  {CLASS_TYPES.map((ct) => (
                    <option key={ct.value} value={ct.value}>
                      {ct.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Instructor</label>
                <input
                  type="text"
                  value={instructor}
                  onChange={(e) => setInstructor(e.target.value)}
                  required
                  className="w-full bg-brand-gray border border-brand-gray rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-accent"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Topic (Optional)</label>
                <select
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full bg-brand-gray border border-brand-gray rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-accent"
                >
                  <option value="">No Topic</option>
                  {SCHEDULE_TOPICS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-brand-accent text-brand-black font-bold px-4 py-2 rounded-lg hover:bg-brand-accent/90 transition text-sm disabled:opacity-50"
                >
                  {submitting ? "Adding..." : "Add to Schedule"}
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <p className="text-gray-500">Loading schedule...</p>
        ) : entries.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No schedule entries yet. Click &quot;Add Class&quot; to get started.
          </div>
        ) : (
          <div className="space-y-6">
            {DAYS_OF_WEEK.map((dayName, dayIndex) => {
              const dayEntries = grouped[dayIndex];
              if (!dayEntries || dayEntries.length === 0) return null;
              return (
                <div key={dayIndex}>
                  <h2 className="text-lg font-bold text-white mb-3">{dayName}</h2>
                  <div className="bg-brand-dark border border-brand-gray rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-brand-gray">
                          <th className="text-left text-xs text-gray-400 uppercase tracking-wider px-4 py-2">Time</th>
                          <th className="text-left text-xs text-gray-400 uppercase tracking-wider px-4 py-2">Class</th>
                          <th className="text-left text-xs text-gray-400 uppercase tracking-wider px-4 py-2">Instructor</th>
                          <th className="text-left text-xs text-gray-400 uppercase tracking-wider px-4 py-2">Topic</th>
                          <th className="text-right text-xs text-gray-400 uppercase tracking-wider px-4 py-2">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dayEntries.map((entry) => (
                          <tr key={entry.id} className="border-b border-brand-gray/50 hover:bg-brand-gray/20 transition">
                            <td className="px-4 py-2 text-sm text-brand-accent font-medium">
                              {formatTime(entry.startTime)} to {formatTime(entry.endTime)}
                            </td>
                            <td className="px-4 py-2 text-sm text-white">{classLabel(entry.classType)}</td>
                            <td className="px-4 py-2 text-sm text-gray-300">{entry.instructor}</td>
                            <td className="px-4 py-2 text-sm text-gray-400">{entry.topic || "—"}</td>
                            <td className="px-4 py-2 text-right">
                              <button
                                onClick={() => handleDelete(entry.id)}
                                className="text-sm text-red-400 hover:text-red-300 transition"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
  );
}
