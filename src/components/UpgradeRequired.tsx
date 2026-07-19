import Link from "next/link";
import { Sparkles } from "lucide-react";

/**
 * Server-rendered upgrade screen for Pro-only pages. Shown instead of the
 * feature when the gym's server-derived entitlement is below Pro — a clear
 * next step, never a dead 402.
 */
export function UpgradeRequired({ feature }: { feature: string }) {
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-lg bg-[#c4b5a0]/10">
        <Sparkles className="h-6 w-6 text-[#c4b5a0]" />
      </div>
      <h1 className="text-xl font-bold text-white">{feature} is a Pro feature</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-gray-400 leading-relaxed">
        Upgrade to Pro ($99/mo) for unlimited members, the lead pipeline, drop-ins,
        events, competition tracking, and advanced analytics.
      </p>
      <div className="mt-6 flex items-center justify-center gap-3">
        <Link
          href="/app/billing"
          className="rounded-lg bg-brand-accent px-6 py-3 text-sm font-bold text-brand-black transition hover:bg-brand-accent/90"
        >
          View Plans
        </Link>
        <Link
          href="/app"
          className="rounded-lg px-6 py-3 text-sm font-medium text-gray-400 transition hover:text-white"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
