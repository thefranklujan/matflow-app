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
  const upcomingMine = Object.values(plans)
    .filter((p) => new Date(p.date) >= new Date(today.getFullYear(), today.getMonth(), today.getDate()))
    .sort((a, b) => a.date.localeCompare(b.date));
  const upcomingFriends = friendPlans
    .filter((p) => new Date(p.date) >= new Date(today.getFullYear(), today.getMonth(), today.getDate()))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 12);

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

      {/* Day detail editor — pinned above the calendar so it's always visible */}
      {selectedDate && (
        <div className="bg-[#0a0a0a] border border-[#dc2626]/40 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider">{selectedDate.toLocaleDateString("en-US", { weekday: "long" })}</p>
              <h3 className="text-white text-lg font-bold">{selectedDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</h3>
            </div>
            <div className="flex items-center gap-3">
              {selPlan && (
                <button onClick={clearDay} disabled={saving} className="text-red-400 hover:text-red-300 inline-flex items-center gap-1 text-xs">
                  <Trash2 className="h-3 w-3" /> Clear day
                </button>
              )}
              <button onClick={() => setSelectedDate(null)} className="text-gray-500 hover:text-white text-2xl leading-none">×</button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-4">
            <BlockToggle label="Morning" icon={<Sunrise className="h-4 w-4" />} active={draftMorning} onClick={() => setDraftMorning(!draftMorning)} />
            <BlockToggle label="Noon" icon={<Sun className="h-4 w-4" />} active={draftNoon} onClick={() => setDraftNoon(!draftNoon)} />
            <BlockToggle label="Afternoon" icon={<Sunset className="h-4 w-4" />} active={draftAfternoon} onClick={() => setDraftAfternoon(!draftAfternoon)} />
          </div>

          <div className="mb-4">
            <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1">Gym</label>
            {myGyms.length > 0 ? (
              <select
                value={draftGym}
                onChange={(e) => setDraftGym(e.target.value)}
                className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
              >
                <option value="">— Choose gym —</option>
                {myGyms.map((g) => (<option key={g.id} value={g.name}>{g.name}</option>))}
                <option value="__other">Other / type below</option>
              </select>
            ) : (
              <input
                type="text"
                value={draftGym}
                onChange={(e) => setDraftGym(e.target.value)}
                placeholder="Where you'll train"
                className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
              />
            )}
            {draftGym === "__other" && (
              <input
                type="text"
                autoFocus
                onChange={(e) => setDraftGym(e.target.value)}
                placeholder="Type a gym name..."
                className="w-full mt-2 bg-black border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
              />
            )}
          </div>

          <button
            onClick={saveDraft}
            disabled={saving}
            className="w-full bg-[#dc2626] hover:bg-[#b91c1c] text-white font-bold py-2.5 rounded-lg text-sm disabled:opacity-50"
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

        {/* Side panel */}
        <div className="space-y-4">
          <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-5">
            <h2 className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-3">Your Plan ({upcomingMine.length})</h2>
            {upcomingMine.length === 0 ? (
              <p className="text-gray-600 text-sm">No training planned yet.</p>
            ) : (
              <div className="space-y-2">
                {upcomingMine.slice(0, 6).map((p) => (
                  <PlanRowCard key={p.date} plan={p} mine />
                ))}
              </div>
            )}
          </div>

          {show && (
            <div className="bg-[#0a0a0a] border border-blue-500/20 rounded-xl p-5">
              <h2 className="text-xs text-blue-400 uppercase tracking-wider font-semibold mb-3">Friends Training ({upcomingFriends.length})</h2>
              {upcomingFriends.length === 0 ? (
                <p className="text-gray-600 text-sm">No friends have shared their schedule yet.</p>
              ) : (
                <div className="space-y-2">
                  {upcomingFriends.map((p, i) => (
                    <FriendRowCard key={`${p.friendName}-${p.date}-${i}`} plan={p} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BlockToggle({ label, icon, active, onClick }: { label: string; icon: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 rounded-lg border py-3 transition ${
        active ? "bg-[#dc2626]/20 border-[#dc2626] text-white" : "bg-white/5 border-white/10 text-gray-400 hover:border-white/20"
      }`}
    >
      {icon}
      <span className="text-xs font-semibold">{label}</span>
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

function PlanRowCard({ plan, mine }: { plan: PlanRow; mine?: boolean }) {
  const d = new Date(plan.date);
  return (
    <div className="flex items-center gap-3 bg-white/5 rounded-lg px-3 py-2">
      <div className={`h-9 w-9 rounded flex flex-col items-center justify-center shrink-0 ${mine ? "bg-[#dc2626]/20 text-[#dc2626]" : "bg-blue-400/20 text-blue-400"}`}>
        <span className="text-[9px] font-bold uppercase leading-none">{d.toLocaleDateString("en-US", { month: "short" })}</span>
        <span className="text-sm font-bold leading-none">{d.getDate()}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-medium truncate">{blockSummary(plan)}</p>
        {plan.gym && <p className="text-gray-500 text-xs truncate">{plan.gym}</p>}
      </div>
    </div>
  );
}

function FriendRowCard({ plan }: { plan: FriendPlanRow }) {
  const d = new Date(plan.date);
  return (
    <div className="flex items-center gap-3 bg-white/5 rounded-lg px-3 py-2">
      <div className="h-9 w-9 rounded bg-blue-400/20 text-blue-400 flex flex-col items-center justify-center shrink-0">
        <span className="text-[9px] font-bold uppercase leading-none">{d.toLocaleDateString("en-US", { month: "short" })}</span>
        <span className="text-sm font-bold leading-none">{d.getDate()}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-medium truncate">{plan.friendName}</p>
        <p className="text-gray-500 text-xs truncate">{blockSummary(plan)}{plan.gym ? ` · ${plan.gym}` : ""}</p>
      </div>
    </div>
  );
}
