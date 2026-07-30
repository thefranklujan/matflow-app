"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, Clock, Check, X, WifiOff, GraduationCap } from "lucide-react";

/**
 * Accessible arrival bottom sheet: "You're at [academy] — are you attending
 * class?" -> pick an eligible class -> confirm -> the server records
 * attendance. Follows the same modal a11y pattern as MobileMoreMenu
 * (focus trap, Escape, body-scroll lock, focus restoration).
 */

export interface ArrivalClass {
  scheduleId: string;
  classType: string;
  instructor: string;
  locationSlug: string;
  startTime: string;
  endTime: string;
  minutesFromStart: number;
}

interface Props {
  gymName: string;
  classes: ArrivalClass[];
  arrivalToken: string;
  /** Called when the sheet should go away. reason lets the parent debounce. */
  onClose: (reason: "dismissed" | "completed") => void;
  /** Called when the arrival attestation expired — parent re-runs the proximity check. */
  onTokenExpired: () => void;
}

type Step =
  | { kind: "ask" }
  | { kind: "pick" }
  | { kind: "confirm"; cls: ArrivalClass }
  | { kind: "submitting"; cls: ArrivalClass }
  | { kind: "done"; message: string }
  | { kind: "error"; message: string; retry: ArrivalClass | null };

function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
}

export default function ArrivalCheckInSheet({ gymName, classes, arrivalToken, onClose, onTokenExpired }: Props) {
  const [step, setStep] = useState<Step>({ kind: "ask" });
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstBtnRef = useRef<HTMLButtonElement>(null);

  // Modal a11y: trap focus, close on Escape, lock body scroll, restore focus.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    firstBtnRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose("dismissed");
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  async function submit(cls: ArrivalClass) {
    setStep({ kind: "submitting", cls });
    try {
      const res = await fetch("/api/student/attendance/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ arrivalToken, classScheduleId: cls.scheduleId }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && (data.result === "checked_in" || data.result === "already_checked_in")) {
        setStep({
          kind: "done",
          message:
            data.result === "checked_in"
              ? `You're checked in for ${data.classType} at ${formatTime(data.startTime)}. Have a good roll!`
              : `You're already checked in for ${data.classType} at ${formatTime(data.startTime)}.`,
        });
        return;
      }
      if (data.result === "token_expired") {
        onTokenExpired();
        return;
      }
      if (data.result === "outside_window") {
        setStep({ kind: "error", message: "This class is no longer open for check-in.", retry: null });
        return;
      }
      if (data.result === "location_conflict") {
        setStep({ kind: "error", message: "You're already checked in for this class at another location. Ask your coach if that looks wrong.", retry: null });
        return;
      }
      setStep({ kind: "error", message: "Check-in didn't go through. Please try again.", retry: cls });
    } catch {
      setStep({ kind: "error", message: "You appear to be offline. Check your connection and try again.", retry: cls });
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60" role="presentation">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="arrival-heading"
        className="w-full max-w-md rounded-t-2xl border border-white/10 bg-brand-dark p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-accent/10">
              <MapPin className="h-5 w-5 text-brand-accent" />
            </div>
            <div className="min-w-0">
              <h2 id="arrival-heading" className="truncate text-base font-bold text-white">
                You&apos;re at {gymName}
              </h2>
              {step.kind === "ask" && <p className="text-sm text-gray-400">Are you attending class?</p>}
            </div>
          </div>
          <button
            onClick={() => onClose(step.kind === "done" ? "completed" : "dismissed")}
            aria-label="Close"
            className="shrink-0 rounded-md p-1.5 text-gray-500 transition hover:bg-white/5 hover:text-gray-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {step.kind === "ask" && (
          <div className="flex gap-3">
            <button
              ref={firstBtnRef}
              onClick={() => setStep(classes.length === 1 ? { kind: "confirm", cls: classes[0] } : { kind: "pick" })}
              className="flex-1 rounded-lg bg-brand-accent py-3 text-sm font-bold text-brand-black transition hover:bg-brand-accent/90"
            >
              Check in
            </button>
            <button
              onClick={() => onClose("dismissed")}
              className="flex-1 rounded-lg border border-white/15 py-3 text-sm font-medium text-gray-300 transition hover:bg-white/5"
            >
              Not now
            </button>
          </div>
        )}

        {step.kind === "pick" && (
          <div>
            <p className="mb-2 text-sm text-gray-400">Which class are you attending?</p>
            <ul className="space-y-2">
              {classes.map((cls) => (
                <li key={cls.scheduleId}>
                  <button
                    onClick={() => setStep({ kind: "confirm", cls })}
                    className="flex w-full items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-left transition hover:border-brand-accent/50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold capitalize text-white">{cls.classType}</span>
                      <span className="block truncate text-xs text-gray-500">
                        {formatTime(cls.startTime)}–{formatTime(cls.endTime)}
                        {cls.instructor ? ` · ${cls.instructor}` : ""}
                        {cls.locationSlug && cls.locationSlug !== "main" ? ` · ${cls.locationSlug}` : ""}
                      </span>
                    </span>
                    <Clock className="h-4 w-4 shrink-0 text-gray-600" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {(step.kind === "confirm" || step.kind === "submitting") && (
          <div>
            <div className="mb-4 flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-4 py-3">
              <GraduationCap className="h-5 w-5 shrink-0 text-brand-accent" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold capitalize text-white">{step.cls.classType}</p>
                <p className="truncate text-xs text-gray-500">
                  {formatTime(step.cls.startTime)}–{formatTime(step.cls.endTime)}
                  {step.cls.instructor ? ` · ${step.cls.instructor}` : ""}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => submit(step.cls)}
                disabled={step.kind === "submitting"}
                className="flex-1 rounded-lg bg-brand-accent py-3 text-sm font-bold text-brand-black transition hover:bg-brand-accent/90 disabled:opacity-50"
              >
                {step.kind === "submitting" ? "Checking in..." : "Confirm check-in"}
              </button>
              <button
                onClick={() => setStep(classes.length === 1 ? { kind: "ask" } : { kind: "pick" })}
                disabled={step.kind === "submitting"}
                className="flex-1 rounded-lg border border-white/15 py-3 text-sm font-medium text-gray-300 transition hover:bg-white/5 disabled:opacity-50"
              >
                Back
              </button>
            </div>
          </div>
        )}

        {step.kind === "done" && (
          <div>
            <div className="mb-4 flex items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3" role="status">
              <Check className="h-5 w-5 shrink-0 text-emerald-400" />
              <p className="text-sm text-emerald-300">{step.message}</p>
            </div>
            <button
              onClick={() => onClose("completed")}
              className="w-full rounded-lg bg-brand-accent py-3 text-sm font-bold text-brand-black transition hover:bg-brand-accent/90"
            >
              Done
            </button>
          </div>
        )}

        {step.kind === "error" && (
          <div>
            <div className="mb-4 flex items-center gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3" role="alert">
              <WifiOff className="h-5 w-5 shrink-0 text-yellow-400" />
              <p className="text-sm text-yellow-300">{step.message}</p>
            </div>
            <div className="flex gap-3">
              {step.retry && (
                <button
                  onClick={() => submit(step.retry!)}
                  className="flex-1 rounded-lg bg-brand-accent py-3 text-sm font-bold text-brand-black transition hover:bg-brand-accent/90"
                >
                  Try again
                </button>
              )}
              <button
                onClick={() => onClose("dismissed")}
                className="flex-1 rounded-lg border border-white/15 py-3 text-sm font-medium text-gray-300 transition hover:bg-white/5"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
