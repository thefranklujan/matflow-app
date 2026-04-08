"use client";

import { useState } from "react";
import { Plus, Trash2, Clock, Swords, Flame } from "lucide-react";
import MilestoneModal from "@/components/student/MilestoneModal";

interface Session {
  id: string;
  date: string;
  duration: number;
  sessionType: string;
  techniques: string | null;
  partners: string | null;
  notes: string | null;
  rollsWon: number;
  rollsLost: number;
}

const SESSION_TYPES = [
  { value: "gi", label: "Gi" },
  { value: "nogi", label: "No-Gi" },
  { value: "openmat", label: "Open Mat" },
  { value: "drilling", label: "Drilling" },
  { value: "competition", label: "Competition" },
  { value: "private", label: "Private Lesson" },
];

export default function TrainingLogClient({
  initialSessions,
  streaks = { current: 0, longest: 0, thisMonth: 0 },
}: {
  initialSessions: Session[];
  streaks?: { current: number; longest: number; thisMonth: number };
}) {
  const [sessions, setSessions] = useState<Session[]>(initialSessions);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [duration, setDuration] = useState(60);
  const [sessionType, setSessionType] = useState("gi");
  const [techniques, setTechniques] = useState("");
  const [partners, setPartners] = useState("");
  const [notes, setNotes] = useState("");
  const [rollsWon, setRollsWon] = useState(0);
  const [rollsLost, setRollsLost] = useState(0);
  const [milestone, setMilestone] = useState<{ count: number; label: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/student/training", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, duration, sessionType, techniques, partners, notes, rollsWon, rollsLost }),
    });
    if (res.ok) {
      const created = await res.json();
      setSessions((prev) => [{
        id: created.id,
        date: created.date,
        duration: created.duration,
        sessionType: created.sessionType,
        techniques: created.techniques,
        partners: created.partners,
        notes: created.notes,
        rollsWon: created.rollsWon,
        rollsLost: created.rollsLost,
      }, ...prev]);
      setShowForm(false);
      setTechniques("");
      setPartners("");
      setNotes("");
      setRollsWon(0);
      setRollsLost(0);
      if (created.milestone) {
        setMilestone(created.milestone);
      }
    }
    setSaving(false);
  }

  async function remove(id: string) {
    if (!confirm("Delete this training session?")) return;
    const res = await fetch(`/api/student/training?id=${id}`, { method: "DELETE" });
    if (res.ok) setSessions((prev) => prev.filter((s) => s.id !== id));
  }

  const totalSessions = sessions.length;
  const totalMinutes = sessions.reduce((sum, s) => sum + s.duration, 0);
  const totalRolls = sessions.reduce((sum, s) => sum + s.rollsWon + s.rollsLost, 0);
  const totalWins = sessions.reduce((sum, s) => sum + s.rollsWon, 0);

  function typeLabel(v: string) {
    return SESSION_TYPES.find((t) => t.value === v)?.label ?? v;
  }

  return (
    <div>
      <MilestoneModal open={!!milestone} milestone={milestone} onClose={() => setMilestone(null)} />
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-white">Training Log</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 bg-[#dc2626] hover:bg-[#b91c1c] text-white font-semibold px-4 py-2 rounded-lg transition text-sm"
        >
          <Plus className="h-4 w-4" />
          {showForm ? "Cancel" : "Log Session"}
        </button>
      </div>

      {/* Streak banner */}
      {streaks.current > 0 && (
        <div className="bg-gradient-to-r from-orange-500/20 to-[#dc2626]/10 border border-orange-500/30 rounded-xl p-4 mb-4 flex items-center gap-4">
          <div className="h-12 w-12 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center">
            <Flame className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <p className="text-orange-300 text-xs uppercase tracking-wider font-semibold">Active Streak</p>
            <p className="text-white text-2xl font-bold leading-tight">
              {streaks.current} day{streaks.current === 1 ? "" : "s"}
            </p>
            <p className="text-gray-400 text-xs mt-0.5">
              Longest streak: <span className="text-white font-semibold">{streaks.longest} days</span>
              {" . "}
              {streaks.thisMonth} session{streaks.thisMonth === 1 ? "" : "s"} this month
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-[#0a0a0a] border border-white/10 rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Sessions</p>
          <p className="text-2xl font-bold text-white mt-1">{totalSessions}</p>
        </div>
        <div className="bg-[#0a0a0a] border border-white/10 rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Total Hours</p>
          <p className="text-2xl font-bold text-white mt-1">{Math.round(totalMinutes / 60)}</p>
        </div>
        <div className="bg-[#0a0a0a] border border-white/10 rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Rolls</p>
          <p className="text-2xl font-bold text-white mt-1">{totalRolls}</p>
        </div>
        <div className="bg-[#0a0a0a] border border-white/10 rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Win %</p>
          <p className="text-2xl font-bold text-[#dc2626] mt-1">
            {totalRolls > 0 ? Math.round((totalWins / totalRolls) * 100) : 0}%
          </p>
        </div>
      </div>

      {showForm && (
        <form onSubmit={submit} className="bg-[#0a0a0a] border border-white/10 rounded-xl p-5 mb-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1">Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1">Duration (min)</label>
              <input type="number" min={0} value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1">Session Type</label>
              <select value={sessionType} onChange={(e) => setSessionType(e.target.value)} className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-white text-sm">
                {SESSION_TYPES.map((t) => (<option key={t.value} value={t.value}>{t.label}</option>))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1">Techniques Drilled</label>
            <input value={techniques} onChange={(e) => setTechniques(e.target.value)} placeholder="e.g. Knee slice, half guard sweep, rear naked" className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1">Training Partners</label>
            <input value={partners} onChange={(e) => setPartners(e.target.value)} placeholder="e.g. Marcus, Sara, Diego" className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1">Rolls Won</label>
              <input type="number" min={0} value={rollsWon} onChange={(e) => setRollsWon(Number(e.target.value))} className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1">Rolls Lost</label>
              <input type="number" min={0} value={rollsLost} onChange={(e) => setRollsLost(Number(e.target.value))} className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="How did the session feel? What clicked?" className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />
          </div>
          <button type="submit" disabled={saving} className="bg-[#dc2626] hover:bg-[#b91c1c] text-white font-semibold px-4 py-2 rounded-lg transition text-sm disabled:opacity-50">
            {saving ? "Saving..." : "Save Session"}
          </button>
        </form>
      )}

      <div className="space-y-3">
        {sessions.length === 0 ? (
          <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-10 text-center">
            <p className="text-white font-semibold mb-1">No sessions logged yet</p>
            <p className="text-gray-500 text-sm">Tap Log Session to record your first training.</p>
          </div>
        ) : (
          sessions.map((s) => (
            <div key={s.id} className="bg-[#0a0a0a] border border-white/10 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <p className="text-white font-semibold">{new Date(s.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</p>
                    <span className="bg-white/5 text-[#dc2626] text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded">{typeLabel(s.sessionType)}</span>
                    <span className="inline-flex items-center gap-1 text-gray-400 text-xs"><Clock className="h-3 w-3" /> {s.duration} min</span>
                    {(s.rollsWon > 0 || s.rollsLost > 0) && (
                      <span className="inline-flex items-center gap-1 text-gray-400 text-xs"><Swords className="h-3 w-3" /> {s.rollsWon}W · {s.rollsLost}L</span>
                    )}
                  </div>
                  {s.techniques && <p className="text-gray-300 text-sm mt-2">{s.techniques}</p>}
                  {s.partners && <p className="text-gray-500 text-xs mt-1">Partners: {s.partners}</p>}
                  {s.notes && <p className="text-gray-400 text-sm mt-2 italic">&ldquo;{s.notes}&rdquo;</p>}
                </div>
                <button onClick={() => remove(s.id)} className="text-gray-600 hover:text-red-400 transition">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
