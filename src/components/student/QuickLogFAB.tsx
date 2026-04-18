"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";

// Floating action button visible on every /student page. Opens a fast
// "quick log" modal so the user can log a session in 10 seconds without
// navigating to /student/training. Kills friction.
export default function QuickLogFAB({ defaultGym }: { defaultGym?: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [duration, setDuration] = useState(60);
  const [sessionType, setSessionType] = useState("class");
  const [gym, setGym] = useState(defaultGym || "");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (defaultGym) setGym(defaultGym);
  }, [defaultGym]);

  async function submit() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/student/training", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: new Date().toISOString(),
          duration,
          sessionType,
          gym: gym || null,
          notes: notes || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || `Failed (${res.status})`);
        setSaving(false);
        return;
      }
      setOpen(false);
      setNotes("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
    setSaving(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed right-4 md:right-8 md:bottom-8 z-[60] h-14 w-14 rounded-full bg-[#dc2626] hover:bg-[#b91c1c] text-white shadow-lg shadow-[#dc2626]/40 flex items-center justify-center transition active:scale-95"
        style={{ bottom: "calc(5rem + env(safe-area-inset-bottom))" }}
        aria-label="Quick log session"
      >
        <Plus className="h-6 w-6" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-end md:items-center md:justify-center p-0 md:p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full md:max-w-md bg-[#0a0a0a] border-t md:border border-white/10 md:rounded-2xl rounded-t-2xl p-5 pb-[calc(env(safe-area-inset-bottom)+20px)] md:pb-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold text-white">Quick Log</h2>
              <button
                onClick={() => setOpen(false)}
                className="h-8 w-8 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1">
                  Duration (minutes)
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[30, 45, 60, 90].map((d) => (
                    <button
                      key={d}
                      onClick={() => setDuration(d)}
                      className={`py-2 rounded-lg text-sm font-semibold transition ${
                        duration === d
                          ? "bg-[#dc2626] text-white"
                          : "bg-white/5 text-gray-300 hover:bg-white/10"
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1">
                  Type
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {["class", "open mat", "private", "drill"].map((t) => (
                    <button
                      key={t}
                      onClick={() => setSessionType(t)}
                      className={`py-2 rounded-lg text-xs font-semibold capitalize transition ${
                        sessionType === t
                          ? "bg-[#dc2626] text-white"
                          : "bg-white/5 text-gray-300 hover:bg-white/10"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1">
                  Gym
                </label>
                <input
                  type="text"
                  value={gym}
                  onChange={(e) => setGym(e.target.value)}
                  placeholder="Where did you train?"
                  className="w-full px-3 py-2 bg-black border border-white/10 rounded-lg text-white text-sm"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1">
                  Notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Techniques, partners, takeaways..."
                  rows={2}
                  className="w-full px-3 py-2 bg-black border border-white/10 rounded-lg text-white text-sm resize-none"
                />
              </div>

              {error && (
                <p className="text-[#dc2626] text-xs">{error}</p>
              )}

              <button
                onClick={submit}
                disabled={saving}
                className="w-full bg-[#dc2626] hover:bg-[#b91c1c] disabled:opacity-50 text-white font-bold py-3 rounded-lg transition"
              >
                {saving ? "Logging..." : "Log Session"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
