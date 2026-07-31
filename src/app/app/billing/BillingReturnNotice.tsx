"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle, Clock, AlertTriangle } from "lucide-react";

/**
 * What the owner sees immediately after returning from hosted Checkout.
 *
 * The governing rule: `?success=true` only means Stripe redirected the browser
 * back. It does NOT mean the payment succeeded — Stripe's own guidance is that
 * a completed session may still be `incomplete`, and the webhook that settles
 * our state may not have arrived yet. So this component never reports "paid"
 * from the query string. It reports "processing" and waits for the SERVER to
 * say the subscription is active, then tells the truth either way.
 */

export type ReturnKind = "success" | "canceled" | null;

export function readReturnKind(search: string): ReturnKind {
  const params = new URLSearchParams(search);
  if (params.get("success") === "true") return "success";
  if (params.get("canceled") === "true") return "canceled";
  return null;
}

/** Statuses that mean the money question is settled, one way or the other. */
const SETTLED = ["active", "past_due", "unpaid", "canceled"];

export interface BillingReturnNoticeProps {
  /** Server-derived subscription status. The only thing trusted here. */
  status: string | null;
  /** Re-fetches the session from the server. */
  refresh: () => Promise<void>;
  /** Opens the Stripe billing portal (the only sanctioned recovery path). */
  onOpenPortal: () => void;
  /** Injectable for tests. */
  initialSearch?: string;
  pollIntervalMs?: number;
  maxPolls?: number;
}

export default function BillingReturnNotice({
  status,
  refresh,
  onOpenPortal,
  initialSearch,
  pollIntervalMs = 2000,
  maxPolls = 10,
}: BillingReturnNoticeProps) {
  const [kind, setKind] = useState<ReturnKind>(null);
  const [gaveUp, setGaveUp] = useState(false);
  const pollsRef = useRef(0);

  // Read the parameters once, then strip them from the URL so a refresh or a
  // shared link cannot replay a stale "you just paid" banner.
  useEffect(() => {
    const search = initialSearch ?? (typeof window === "undefined" ? "" : window.location.search);
    const detected = readReturnKind(search);
    if (!detected) return;
    setKind(detected);

    if (typeof window !== "undefined" && window.history?.replaceState) {
      const url = new URL(window.location.href);
      url.searchParams.delete("success");
      url.searchParams.delete("canceled");
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    }
  }, [initialSearch]);

  const settled = status !== null && SETTLED.includes(status);
  const waiting = kind === "success" && !settled && !gaveUp;

  const tick = useCallback(async () => {
    pollsRef.current += 1;
    await refresh();
    if (pollsRef.current >= maxPolls) setGaveUp(true);
  }, [refresh, maxPolls]);

  // Bounded polling only. An unbounded poll would hammer the server forever on
  // a subscription that is never going to activate.
  useEffect(() => {
    if (!waiting) return;
    const id = setInterval(tick, pollIntervalMs);
    return () => clearInterval(id);
  }, [waiting, tick, pollIntervalMs]);

  if (!kind) return null;

  if (kind === "canceled") {
    return (
      <div role="status" className="flex items-start gap-3 bg-gray-500/10 border border-gray-500/30 rounded-lg p-4 mb-6">
        <AlertTriangle className="h-5 w-5 text-gray-300 shrink-0 mt-0.5" aria-hidden="true" />
        <div>
          <p className="text-white font-semibold">Checkout canceled</p>
          <p className="text-gray-400 text-sm">
            You left checkout before it finished. Your plan has not changed. You can pick a plan again whenever you are ready.
          </p>
        </div>
      </div>
    );
  }

  if (waiting) {
    return (
      <div role="status" aria-live="polite" className="flex items-start gap-3 bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
        <Clock className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" aria-hidden="true" />
        <div>
          <p className="text-white font-semibold">Finishing your subscription</p>
          <p className="text-gray-400 text-sm">
            Stripe is confirming your payment. This page updates itself; it usually takes a few seconds.
          </p>
        </div>
      </div>
    );
  }

  if (gaveUp && !settled) {
    return (
      <div role="alert" className="flex items-start gap-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-6">
        <AlertTriangle className="h-5 w-5 text-yellow-400 shrink-0 mt-0.5" aria-hidden="true" />
        <div>
          <p className="text-white font-semibold">Still confirming your payment</p>
          <p className="text-gray-400 text-sm">
            We have not had confirmation from Stripe yet. This can happen when a payment needs extra
            verification. Open billing management to check the payment, or refresh this page in a minute.
            Do not start a second checkout.
          </p>
          <button
            type="button"
            onClick={onOpenPortal}
            className="mt-3 text-sm font-semibold text-yellow-300 underline underline-offset-4 hover:text-yellow-200"
          >
            Open billing management
          </button>
        </div>
      </div>
    );
  }

  if (status === "active") {
    return (
      <div role="status" className="flex items-start gap-3 bg-green-500/10 border border-green-500/30 rounded-lg p-4 mb-6">
        <CheckCircle className="h-5 w-5 text-green-400 shrink-0 mt-0.5" aria-hidden="true" />
        <div>
          <p className="text-white font-semibold">Subscription active</p>
          <p className="text-gray-400 text-sm">Your payment is confirmed and your academy is on a paid plan.</p>
        </div>
      </div>
    );
  }

  // Settled, but not into an active plan (past_due, unpaid, canceled). Say so
  // plainly rather than implying the checkout worked.
  return (
    <div role="alert" className="flex items-start gap-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-6">
      <AlertTriangle className="h-5 w-5 text-yellow-400 shrink-0 mt-0.5" aria-hidden="true" />
      <div>
        <p className="text-white font-semibold">Payment needs attention</p>
        <p className="text-gray-400 text-sm">
          Checkout finished, but your subscription is not active yet. Open billing management to update your
          payment method. Do not start a second checkout.
        </p>
        <button
          type="button"
          onClick={onOpenPortal}
          className="mt-3 text-sm font-semibold text-yellow-300 underline underline-offset-4 hover:text-yellow-200"
        >
          Open billing management
        </button>
      </div>
    </div>
  );
}
