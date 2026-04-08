"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Play, Pause, RotateCcw, SkipForward, Plus, Minus, Volume2, VolumeX, Maximize2 } from "lucide-react";

// Standard BJJ competition match lengths by belt (IBJJF):
//  white  5 min
//  blue   5 min
//  purple 6 min
//  brown  7 min
//  black 10 min
// Plus drilling rounds and open mat are commonly 5 to 10 min with 30 to 60s rest.
const PRESETS = [
  { label: "White / Blue", round: 5 * 60, rest: 60, rounds: 6, sub: "5 min rounds" },
  { label: "Purple", round: 6 * 60, rest: 60, rounds: 6, sub: "6 min rounds" },
  { label: "Brown", round: 7 * 60, rest: 60, rounds: 6, sub: "7 min rounds" },
  { label: "Black", round: 10 * 60, rest: 60, rounds: 5, sub: "10 min rounds" },
  { label: "Open Mat", round: 5 * 60, rest: 30, rounds: 12, sub: "Quick rounds" },
  { label: "Drilling", round: 3 * 60, rest: 30, rounds: 10, sub: "Short bursts" },
];

type Phase = "ready" | "round" | "rest" | "done";

const STORAGE_KEY = "matflow-bjj-clock";

interface Settings {
  roundSec: number;
  restSec: number;
  totalRounds: number;
  soundOn: boolean;
}

const DEFAULTS: Settings = {
  roundSec: 5 * 60,
  restSec: 60,
  totalRounds: 6,
  soundOn: true,
};

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

export default function BJJClockClient() {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [hydrated, setHydrated] = useState(false);

  const [phase, setPhase] = useState<Phase>("ready");
  const [round, setRound] = useState(1);
  const [secondsLeft, setSecondsLeft] = useState(DEFAULTS.roundSec);
  const [running, setRunning] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  const [showCustom, setShowCustom] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // Load settings
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Settings>;
        const next = { ...DEFAULTS, ...parsed };
        setSettings(next);
        setSecondsLeft(next.roundSec);
      }
    } catch {}
    setHydrated(true);
  }, []);

  // Persist settings
  useEffect(() => {
    if (hydrated) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      } catch {}
    }
  }, [settings, hydrated]);

  // Landscape detection for fullscreen mode
  useEffect(() => {
    if (typeof window === "undefined") return;
    function check() {
      setIsLandscape(window.innerWidth > window.innerHeight && window.innerHeight < 600);
    }
    check();
    window.addEventListener("resize", check);
    window.addEventListener("orientationchange", check);
    return () => {
      window.removeEventListener("resize", check);
      window.removeEventListener("orientationchange", check);
    };
  }, []);

  // Beep + vibrate
  const beep = useCallback((freq: number, duration: number, count = 1) => {
    if (!settings.soundOn) {
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(Array(count).fill(150).flatMap((d) => [d, 80]));
      }
      return;
    }
    try {
      if (!audioCtxRef.current) {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioCtxRef.current = new Ctx();
      }
      const ctx = audioCtxRef.current;
      for (let i = 0; i < count; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = freq;
        osc.type = "sine";
        gain.gain.value = 0.0001;
        osc.connect(gain).connect(ctx.destination);
        const t = ctx.currentTime + i * (duration + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.4, t + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
        osc.start(t);
        osc.stop(t + duration + 0.02);
      }
    } catch {}
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(Array(count).fill(150).flatMap((d) => [d, 80]));
    }
  }, [settings.soundOn]);

  // Keep screen awake while the clock is running. Re-acquire on visibility
  // change because iOS / Safari release the lock when the tab loses focus.
  useEffect(() => {
    let cancelled = false;

    async function acquire() {
      try {
        const nav = navigator as Navigator & { wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinel> } };
        if (nav.wakeLock?.request) {
          const lock = await nav.wakeLock.request("screen");
          if (cancelled) {
            lock.release().catch(() => {});
            return;
          }
          wakeLockRef.current = lock;
          lock.addEventListener?.("release", () => {
            wakeLockRef.current = null;
          });
        }
      } catch {}
    }

    async function release() {
      if (wakeLockRef.current) {
        try {
          await wakeLockRef.current.release();
        } catch {}
        wakeLockRef.current = null;
      }
    }

    function onVisibility() {
      if (document.visibilityState === "visible" && running && !wakeLockRef.current) {
        acquire();
      }
    }

    if (running) {
      acquire();
      document.addEventListener("visibilitychange", onVisibility);
    } else {
      release();
    }

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      release();
    };
  }, [running]);

  // Timer tick
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setSecondsLeft((s) => {
        if (s > 1) {
          // Warning beep at 10 seconds
          if (s === 11) beep(880, 0.12, 1);
          return s - 1;
        }
        // Phase transition
        setPhase((currentPhase) => {
          if (currentPhase === "round") {
            // Round just ended
            beep(600, 0.25, 2);
            if (round >= settings.totalRounds) {
              setRunning(false);
              return "done";
            }
            // Start rest
            setSecondsLeft(settings.restSec);
            return "rest";
          }
          if (currentPhase === "rest") {
            // Rest just ended, next round
            beep(880, 0.18, 3);
            setRound((r) => r + 1);
            setSecondsLeft(settings.roundSec);
            return "round";
          }
          return currentPhase;
        });
        return 0;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running, round, settings.totalRounds, settings.restSec, settings.roundSec, beep]);

  function start() {
    if (phase === "ready" || phase === "done") {
      setRound(1);
      setSecondsLeft(settings.roundSec);
      setPhase("round");
      // Big start beep
      beep(880, 0.3, 1);
    }
    setRunning(true);
  }

  function pause() {
    setRunning(false);
  }

  function reset() {
    setRunning(false);
    setRound(1);
    setSecondsLeft(settings.roundSec);
    setPhase("ready");
  }

  function skip() {
    if (phase === "round") {
      if (round >= settings.totalRounds) {
        setRunning(false);
        setPhase("done");
        return;
      }
      setPhase("rest");
      setSecondsLeft(settings.restSec);
    } else if (phase === "rest") {
      setRound((r) => r + 1);
      setSecondsLeft(settings.roundSec);
      setPhase("round");
    }
  }

  function applyPreset(p: { round: number; rest: number; rounds: number }) {
    setSettings((s) => ({ ...s, roundSec: p.round, restSec: p.rest, totalRounds: p.rounds }));
    setSecondsLeft(p.round);
    setRound(1);
    setPhase("ready");
    setRunning(false);
  }

  // Color and label per phase
  const phaseLabel = phase === "round" ? `ROUND ${round} OF ${settings.totalRounds}` : phase === "rest" ? "REST" : phase === "done" ? "FINISHED" : "READY";
  const phaseColor = phase === "round" ? "#dc2626" : phase === "rest" ? "#22c55e" : phase === "done" ? "#fbbf24" : "#737373";
  const ringTotal = phase === "rest" ? settings.restSec : settings.roundSec;
  const ringPct = ringTotal > 0 ? secondsLeft / ringTotal : 0;

  // SVG ring values
  const radius = isLandscape ? 200 : 140;
  const stroke = 14;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - ringPct);

  return (
    <div className={isLandscape ? "fixed inset-0 z-[100] bg-black flex items-center justify-center" : "min-h-[calc(100vh-160px)]"}>
      {!isLandscape && (
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white">BJJ Clock</h1>
          <p className="text-gray-500 text-sm mt-1">Round timer for sparring, drilling, and open mats.</p>
        </div>
      )}

      <div className={isLandscape ? "w-full px-8 flex items-center gap-8 justify-center" : ""}>
        {/* Timer card */}
        <div className={isLandscape ? "" : "bg-[#0a0a0a] border border-white/10 rounded-3xl p-6 mb-6"}>
          <div className="flex flex-col items-center">
            <div className={`text-xs uppercase tracking-[0.3em] font-bold mb-4 ${isLandscape ? "text-base" : ""}`} style={{ color: phaseColor }}>
              {phaseLabel}
            </div>

            {/* Ring + countdown */}
            <div className="relative" style={{ width: (radius + stroke) * 2, height: (radius + stroke) * 2 }}>
              <svg width={(radius + stroke) * 2} height={(radius + stroke) * 2} className="-rotate-90">
                <circle
                  cx={radius + stroke}
                  cy={radius + stroke}
                  r={radius}
                  fill="none"
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth={stroke}
                />
                <circle
                  cx={radius + stroke}
                  cy={radius + stroke}
                  r={radius}
                  fill="none"
                  stroke={phaseColor}
                  strokeWidth={stroke}
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={dashOffset}
                  style={{ transition: "stroke-dashoffset 0.9s linear, stroke 0.3s" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div
                  className="font-bold text-white tabular-nums leading-none"
                  style={{ fontSize: isLandscape ? 160 : 96, letterSpacing: "-0.04em" }}
                >
                  {fmt(secondsLeft)}
                </div>
                {phase === "round" && (
                  <div className="text-gray-500 text-xs uppercase tracking-wider mt-3">
                    {settings.totalRounds - round} {settings.totalRounds - round === 1 ? "round" : "rounds"} remaining
                  </div>
                )}
                {phase === "done" && (
                  <div className="text-yellow-400 text-sm uppercase tracking-wider mt-3 font-bold">
                    Great work
                  </div>
                )}
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3 mt-8">
              <button
                onClick={reset}
                className="h-14 w-14 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 flex items-center justify-center transition"
                title="Reset"
              >
                <RotateCcw className="h-5 w-5" />
              </button>
              {running ? (
                <button
                  onClick={pause}
                  className="h-20 w-20 rounded-full bg-[#dc2626] hover:bg-[#b91c1c] text-white flex items-center justify-center shadow-lg shadow-[#dc2626]/40 transition active:scale-95"
                >
                  <Pause className="h-9 w-9" fill="currentColor" />
                </button>
              ) : (
                <button
                  onClick={start}
                  className="h-20 w-20 rounded-full bg-[#dc2626] hover:bg-[#b91c1c] text-white flex items-center justify-center shadow-lg shadow-[#dc2626]/40 transition active:scale-95"
                >
                  <Play className="h-9 w-9 ml-1" fill="currentColor" />
                </button>
              )}
              <button
                onClick={skip}
                disabled={phase === "ready" || phase === "done"}
                className="h-14 w-14 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 flex items-center justify-center transition disabled:opacity-30"
                title="Skip"
              >
                <SkipForward className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar in landscape */}
        {isLandscape && (
          <div className="text-white text-sm space-y-3 max-w-[180px]">
            <div>
              <div className="text-gray-500 text-[10px] uppercase tracking-wider font-bold mb-1">Round</div>
              <div className="text-2xl font-bold">{fmt(settings.roundSec)}</div>
            </div>
            <div>
              <div className="text-gray-500 text-[10px] uppercase tracking-wider font-bold mb-1">Rest</div>
              <div className="text-2xl font-bold">{fmt(settings.restSec)}</div>
            </div>
            <div>
              <div className="text-gray-500 text-[10px] uppercase tracking-wider font-bold mb-1">Rounds</div>
              <div className="text-2xl font-bold">{settings.totalRounds}</div>
            </div>
            <button
              onClick={() => setSettings((s) => ({ ...s, soundOn: !s.soundOn }))}
              className="text-gray-500 hover:text-white text-xs flex items-center gap-1.5 mt-2"
            >
              {settings.soundOn ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />}
              {settings.soundOn ? "Sound on" : "Sound off"}
            </button>
          </div>
        )}
      </div>

      {!isLandscape && (
        <>
          {/* Sound + landscape hint */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => setSettings((s) => ({ ...s, soundOn: !s.soundOn }))}
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-white"
            >
              {settings.soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              {settings.soundOn ? "Sound on" : "Sound off"}
            </button>
            <div className="flex items-center gap-1.5 text-xs text-gray-600">
              <Maximize2 className="h-3 w-3" />
              Rotate phone for full screen
            </div>
          </div>

          {/* Quick presets */}
          <div className="mb-6">
            <h2 className="text-xs uppercase tracking-wider text-gray-500 font-bold mb-3">Quick Start</h2>
            <div className="grid grid-cols-2 gap-2">
              {PRESETS.map((p) => {
                const active =
                  settings.roundSec === p.round &&
                  settings.restSec === p.rest &&
                  settings.totalRounds === p.rounds;
                return (
                  <button
                    key={p.label}
                    onClick={() => applyPreset(p)}
                    className={`text-left p-3 rounded-xl border transition ${
                      active
                        ? "bg-[#dc2626]/15 border-[#dc2626]"
                        : "bg-[#0a0a0a] border-white/10 hover:border-white/20"
                    }`}
                  >
                    <div className="text-white font-semibold text-sm">{p.label}</div>
                    <div className="text-gray-500 text-xs mt-0.5">
                      {p.sub} · {p.rounds} rounds · {p.rest}s rest
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom */}
          <div>
            <button
              onClick={() => setShowCustom((v) => !v)}
              className="text-xs uppercase tracking-wider text-gray-500 font-bold mb-3 hover:text-white flex items-center gap-1"
            >
              {showCustom ? "Hide" : "Customize"}
            </button>
            {showCustom && (
              <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-4 space-y-4">
                <NumberRow
                  label="Round Length"
                  value={settings.roundSec}
                  display={fmt(settings.roundSec)}
                  step={30}
                  min={30}
                  max={20 * 60}
                  onChange={(v) => {
                    setSettings((s) => ({ ...s, roundSec: v }));
                    if (phase === "ready") setSecondsLeft(v);
                  }}
                />
                <NumberRow
                  label="Rest Length"
                  value={settings.restSec}
                  display={fmt(settings.restSec)}
                  step={15}
                  min={0}
                  max={5 * 60}
                  onChange={(v) => setSettings((s) => ({ ...s, restSec: v }))}
                />
                <NumberRow
                  label="Total Rounds"
                  value={settings.totalRounds}
                  display={String(settings.totalRounds)}
                  step={1}
                  min={1}
                  max={30}
                  onChange={(v) => setSettings((s) => ({ ...s, totalRounds: v }))}
                />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function NumberRow({
  label,
  value,
  display,
  step,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  display: string;
  step: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-400">{label}</span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(Math.max(min, value - step))}
          className="h-8 w-8 rounded-lg bg-white/5 hover:bg-white/10 text-white flex items-center justify-center"
        >
          <Minus className="h-4 w-4" />
        </button>
        <div className="text-white font-bold tabular-nums w-16 text-center">{display}</div>
        <button
          onClick={() => onChange(Math.min(max, value + step))}
          className="h-8 w-8 rounded-lg bg-white/5 hover:bg-white/10 text-white flex items-center justify-center"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
