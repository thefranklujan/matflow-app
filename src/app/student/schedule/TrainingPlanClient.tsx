"use client";

import { useState, useMemo, useEffect } from "react";
import { ChevronLeft, ChevronRight, Sunrise, Sun, Sunset, Trash2, Eye, EyeOff } from "lucide-react";

interface PlanRow {
  date: string;
  morning: boolean;
  noon: boolean;
  afternoon: boolean;
  gym: string | null;
}

interface FriendPlanRow extends PlanRow {
  friendName: string;
  belt: string;
}

interface GymOption {
  id: string;
  name: string;
}

const DAY_INITIALS = ["S", "M", "T", "W", "T", "F", "S"];

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function TrainingPlanClient({
  shareSchedule: initShare,
  showFriendsSchedule: initShow,
  myGyms,
  initialPlans,
  friendPlans,
}: {
  shareSchedule: boolean;
  showFriendsSchedule: boolean;
  myGyms: GymOption[];
  initialPlans: PlanRow[];
  friendPlans: FriendPlanRow[];
}) {
  const [share, setShare] = useState(initShare);
  const [show, setShow] = useState(initShow);
  const [plans, setPlans] = useState<Record<string, PlanRow>>(() => {
    const m: Record<string, PlanRow> = {};
    for (const p of initialPlans) m[p.date] = p;
    return m;
  });
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);

  const today = new Date();
  function isSameDay(a: Date, b: Date) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }
  function isPast(d: Date) {
    const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return d < t;
  }

  const cells = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const startWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const arr: (Date | null)[] = [];
    for (let i = 0; i < startWeekday; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++) arr.push(new Date(year, month, d));
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [cursor]);

  // Group friend plans by date for the calendar overlay
  const friendsByDate = useMemo(() => {
    const m = new Map<string, FriendPlanRow[]>();
    if (show) {
      for (const fp of friendPlans) {
        if (!m.has(fp.date)) m.set(fp.date, []);
        m.get(fp.date)!.push(fp);
      }
    }
    return m;
  }, [friendPlans, show]);

  const selKey = selectedDate ? dateKey(selectedDate) : null;
  const selPlan = selKey ? plans[selKey] : undefined;
  const [draftMorning, setDraftMorning] = useState(false);
  const [draftNoon, setDraftNoon] = useState(false);
  const [draftAfternoon, setDraftAfternoon] = useState(false);
  const [draftGym, setDraftGym] = useState("");

  // Sync draft when selecting a new date
  useEffect(() => {
    if (selPlan) {
      setDraftMorning(selPlan.morning);
      setDraftNoon(selPlan.noon);
      setDraftAfternoon(selPlan.afternoon);
      setDraftGym(selPlan.gym || "");
    } else {
      setDraftMorning(false);
      setDraftNoon(false);
      setDraftAfternoon(false);
      setDraftGym("");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selKey]);

  async function saveDraft() {
    if (!selKey || !selectedDate) return;
    setSaving(true);
    const res = await fetch("/api/student/training-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: selKey,
        morning: draftMorning,
        noon: draftNoon,
        afternoon: draftAfternoon,
        gym: draftGym || null,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.deleted) {
        setPlans((prev) => {
          const next = { ...prev };
          delete next[selKey];
          return next;
        });
      } else {
        setPlans((prev) => ({
          ...prev,
          [selKey]: {
            date: selKey,
            morning: draftMorning,
            noon: draftNoon,
            afternoon: draftAfternoon,
            gym: draftGym || null,
          },
        }));
      }
    }
    setSaving(false);
  }

  async function clearDay() {
    if (!selKey) return;
    setSaving(true);
    await fetch(`/api/student/training-plan?date=${selKey}`, { method: "DELETE" });
    setPlans((prev) => {
      const next = { ...prev };
      delete next[selKey];
      return next;
    });
    setDraftMorning(false);
    setDraftNoon(false);
    setDraftAfternoon(false);
    setDraftGym("");
    setSaving(false);
  }

  async function deletePlanByDate(dateStr: string) {
    await fetch(`/api/student/training-plan?date=${dateStr}`, { method: "DELETE" });
    setPlans((prev) => {
      const next = { ...prev };
      delete next[dateStr];
      return next;
    });
    if (selKey === dateStr) {
      setSelectedDate(null);
    }
  }

  function editPlanByDate(dateStr: string) {
    const [y, m, d] = dateStr.split("-").map(Number);
    setSelectedDate(new Date(y, (m || 1) - 1, d || 1));
  }

  async function toggleVisibility(field: "shareSchedule" | "showFriendsSchedule", value: boolean) {
    if (field === "shareSchedule") setShare(value);
    if (field === "showFriendsSchedule") setShow(value);
    await fetch("/api/student/visibility", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
  }

  const monthLabel = cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  // Compare as YYYY-MM-DD strings to avoid timezone shifts.
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  // Build a unified timeline keyed by date. Each entry holds my plan (if any)
  // and any friend plans on that date. Days I'm training AND friend-only days
  // both show up, sorted ascending.
  const unifiedDays = useMemo(() => {
    const byDate = new Map<string, { date: string; mine?: PlanRow; friends: FriendPlanRow[] }>();
    for (const p of Object.values(plans)) {
      if (p.date < todayKey) continue;
      byDate.set(p.date, { date: p.date, mine: p, friends: [] });
    }
    if (show) {
      for (const fp of friendPlans) {
        if (fp.date < todayKey) continue;
        const existing = byDate.get(fp.date);
        if (existing) {
          existing.friends.push(fp);
        } else {
          byDate.set(fp.date, { date: fp.date, friends: [fp] });
        }
      }
    }
    return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [plans, friendPlans, show, todayKey]);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Training Schedule</h1>
          <p className="text-gray-500 text-sm mt-1">Tap any future day to plan when you&apos;ll train.</p>
        </div>
      </div>

      {/* Visibility toggles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        <button
          onClick={() => toggleVisibility("shareSchedule", !share)}
          className={`flex items-center justify-between bg-[#0a0a0a] border rounded-xl px-5 py-4 text-left transition ${
            share ? "border-[#dc2626]" : "border-white/10 hover:border-white/20"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${share ? "bg-[#dc2626]/20 text-[#dc2626]" : "bg-white/5 text-gray-500"}`}>
              {share ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </div>
            <div>
              <p className="text-white font-semibold text-sm">Share my schedule</p>
              <p className="text-gray-500 text-xs">{share ? "Friends from your gym groups can see your training days." : "Your schedule is private."}</p>
            </div>
          </div>
          <div className={`relative h-6 w-11 rounded-full transition shrink-0 ${share ? "bg-[#dc2626]" : "bg-white/10"}`}>
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${share ? "left-[1.375rem]" : "left-0.5"}`} />
          </div>
        </button>

        <button
          onClick={() => toggleVisibility("showFriendsSchedule", !show)}
          className={`flex items-center justify-between bg-[#0a0a0a] border rounded-xl px-5 py-4 text-left transition ${
            show ? "border-[#dc2626]" : "border-white/10 hover:border-white/20"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${show ? "bg-[#dc2626]/20 text-[#dc2626]" : "bg-white/5 text-gray-500"}`}>
              {show ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </div>
            <div>
              <p className="text-white font-semibold text-sm">Show friends&apos; schedules</p>
              <p className="text-gray-500 text-xs">{show ? "See when your gym crew is training." : "Hide friends from this page."}</p>
            </div>
          </div>
          <div className={`relative h-6 w-11 rounded-full transition shrink-0 ${show ? "bg-[#dc2626]" : "bg-white/10"}`}>
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${show ? "left-[1.375rem]" : "left-0.5"}`} />
          </div>
        </button>
      </div>

      {/* Day detail editor. compact, pinned above the calendar */}
      {selectedDate && (
        <div className="bg-[#0a0a0a] border border-[#dc2626]/40 rounded-lg p-3 mb-4 max-w-2xl">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="flex items-baseline gap-2 min-w-0">
              <p className="text-white text-sm font-bold truncate">
                {selectedDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {selPlan && (
                <button onClick={clearDay} disabled={saving} className="text-red-400 hover:text-red-300 inline-flex items-center gap-1 text-[10px] uppercase tracking-wider">
                  <Trash2 className="h-3 w-3" /> Clear
                </button>
              )}
              <button onClick={() => setSelectedDate(null)} className="text-gray-500 hover:text-white text-lg leading-none">×</button>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-2">
            <CompactBlock label="AM" icon={<Sunrise className="h-3 w-3" />} active={draftMorning} onClick={() => setDraftMorning(!draftMorning)} />
            <CompactBlock label="Noon" icon={<Sun className="h-3 w-3" />} active={draftNoon} onClick={() => setDraftNoon(!draftNoon)} />
            <CompactBlock label="PM" icon={<Sunset className="h-3 w-3" />} active={draftAfternoon} onClick={() => setDraftAfternoon(!draftAfternoon)} />
            {myGyms.length > 0 ? (
              <select
                value={draftGym}
                onChange={(e) => setDraftGym(e.target.value)}
                className="flex-1 bg-black border border-white/10 rounded px-2 py-1.5 text-white text-xs"
              >
                <option value=""> Gym </option>
                {myGyms.map((g) => (<option key={g.id} value={g.name}>{g.name}</option>))}
                <option value="__other">Other</option>
              </select>
            ) : (
              <input
                type="text"
                value={draftGym}
                onChange={(e) => setDraftGym(e.target.value)}
                placeholder="Gym"
                className="flex-1 bg-black border border-white/10 rounded px-2 py-1.5 text-white text-xs"
              />
            )}
          </div>

          {draftGym === "__other" && (
            <input
              type="text"
              autoFocus
              onChange={(e) => setDraftGym(e.target.value)}
              placeholder="Type a gym name..."
              className="w-full mb-2 bg-black border border-white/10 rounded px-2 py-1.5 text-white text-xs"
            />
          )}

          <button
            onClick={saveDraft}
            disabled={saving}
            className="w-full bg-[#dc2626] hover:bg-[#b91c1c] text-white font-semibold py-1.5 rounded text-xs disabled:opacity-50"
          >
            {saving ? "Saving..." : selPlan ? "Update" : "Mark as training day"}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-2 bg-[#0a0a0a] border border-white/10 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} className="p-1.5 rounded hover:bg-white/5 text-gray-400 hover:text-white">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <h2 className="text-lg font-bold text-white">{monthLabel}</h2>
            <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} className="p-1.5 rounded hover:bg-white/5 text-gray-400 hover:text-white">
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4 pb-4 border-b border-white/5 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#dc2626]" /> You</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-blue-400" /> Friends</span>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-2">
            {DAY_INITIALS.map((d, i) => (<div key={i} className="text-center text-xs text-gray-500 font-semibold py-1">{d}</div>))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((d, i) => {
              if (!d) return <div key={i} />;
              const k = dateKey(d);
              const mine = plans[k];
              const fc = friendsByDate.get(k)?.length ?? 0;
              const isToday = isSameDay(d, today);
              const past = isPast(d);
              const isSel = !!selectedDate && isSameDay(d, selectedDate);
              return (
                <button
                  key={i}
                  onClick={() => !past && setSelectedDate(d)}
                  disabled={past}
                  className={`aspect-square rounded-lg flex flex-col items-center justify-center text-sm transition border ${
                    isSel ? "bg-[#dc2626]/20 border-[#dc2626] text-white"
                    : mine ? "bg-[#dc2626]/15 border-[#dc2626]/40 text-white"
                    : isToday ? "border-white/30 text-white"
                    : past ? "border-transparent text-gray-700 cursor-not-allowed"
                    : "border-white/5 text-gray-300 hover:bg-white/5"
                  }`}
                >
                  <span className={isToday ? "font-bold" : ""}>{d.getDate()}</span>
                  <div className="mt-0.5 flex items-center gap-0.5">
                    {mine && <span className="h-1.5 w-1.5 rounded-full bg-[#dc2626]" />}
                    {fc > 0 && <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Side panel: one card per day, mine + friends combined */}
        <div className="space-y-3">
          <h2 className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Upcoming ({unifiedDays.length})</h2>
          {unifiedDays.length === 0 ? (
            <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-5">
              <p className="text-gray-600 text-sm">No training planned yet. Tap a day on the calendar to start.</p>
            </div>
          ) : (
            unifiedDays.slice(0, 12).map((day) => (
              <DayCard
                key={day.date}
                date={day.date}
                mine={day.mine}
                friends={day.friends}
                onEdit={() => editPlanByDate(day.date)}
                onDelete={day.mine ? () => deletePlanByDate(day.date) : undefined}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function CompactBlock({ label, icon, active, onClick }: { label: string; icon: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded border px-2 py-1.5 text-xs font-semibold transition ${
        active ? "bg-[#dc2626]/20 border-[#dc2626] text-white" : "bg-white/5 border-white/10 text-gray-400 hover:border-white/20"
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function blockSummary(p: PlanRow) {
  const blocks = [];
  if (p.morning) blocks.push("Morning");
  if (p.noon) blocks.push("Noon");
  if (p.afternoon) blocks.push("Afternoon");
  return blocks.join(" · ") || "Training";
}

function DayCard({
  date,
  mine,
  friends,
  onEdit,
  onDelete,
}: {
  date: string;
  mine?: PlanRow;
  friends: FriendPlanRow[];
  onEdit: () => void;
  onDelete?: () => void;
}) {
  const [y, m, dd] = date.split("-").map(Number);
  const d = new Date(y, (m || 1) - 1, dd || 1);
  const isToday = new Date().toDateString() === d.toDateString();
  const hasMine = !!mine;

  return (
    <div
      className={`group bg-[#0a0a0a] border rounded-xl overflow-hidden transition ${
        hasMine ? "border-[#dc2626]/30 hover:border-[#dc2626]/60" : "border-blue-500/20 hover:border-blue-500/40"
      }`}
    >
      <button onClick={onEdit} className="w-full text-left p-4">
        <div className="flex items-center gap-3 mb-2">
          <div className={`h-12 w-12 rounded-lg flex flex-col items-center justify-center shrink-0 ${
            hasMine ? "bg-[#dc2626]/20 text-[#dc2626]" : "bg-blue-400/20 text-blue-400"
          }`}>
            <span className="text-[10px] font-bold uppercase leading-none">{d.toLocaleDateString("en-US", { month: "short" })}</span>
            <span className="text-lg font-bold leading-none mt-0.5">{d.getDate()}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm">
              {isToday ? "Today" : d.toLocaleDateString("en-US", { weekday: "long" })}
            </p>
            {hasMine ? (
              <p className="text-gray-400 text-xs truncate">
                {blockSummary(mine)}{mine.gym ? ` · ${mine.gym}` : ""}
              </p>
            ) : (
              <p className="text-blue-400/80 text-xs">Friends only</p>
            )}
          </div>
          {hasMine && onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`Delete training on ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}?`)) {
                  onDelete();
                }
              }}
              className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-[#dc2626] transition p-1 shrink-0"
              title="Delete"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          )}
        </div>
      </button>

      {friends.length > 0 && (
        <div className="border-t border-white/5 bg-white/[0.02] px-4 py-3">
          <p className="text-[10px] uppercase tracking-wider text-blue-400 font-semibold mb-2">
            {friends.length} friend{friends.length === 1 ? "" : "s"} training
          </p>
          <div className="space-y-1.5">
            {friends.map((f, i) => (
              <div key={`${f.friendName}-${i}`} className="flex items-center gap-2 text-xs">
                <div className="h-5 w-5 rounded-full bg-blue-400/20 text-blue-400 flex items-center justify-center text-[9px] font-bold shrink-0">
                  {f.friendName.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                </div>
                <span className="text-white font-medium">{f.friendName}</span>
                <span className="text-gray-500 truncate">
                  {blockSummary(f)}{f.gym ? ` · ${f.gym}` : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

