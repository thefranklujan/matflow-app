"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { CreditCard, CheckCircle, AlertTriangle, Clock, XCircle } from "lucide-react";

const PLANS = [
  {
    name: "Basic",
    price: "$49",
    period: "/mo",
    description: "Up to 100 members",
    features: [
      "Member management",
      "Attendance tracking",
      "Belt progression",
      "Class schedule",
      "Announcements",
      "Video library",
    ],
    priceId: process.env.NEXT_PUBLIC_STRIPE_BASIC_PRICE_ID || "price_basic",
  },
  {
    name: "Pro",
    price: "$99",
    period: "/mo",
    description: "Unlimited members",
    features: [
      "Everything in Basic",
      "Pro shop / e-commerce",
      "Events & competitions",
      "Leaderboard & goals",
      "Custom branding",
      "Priority support",
    ],
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID || "price_pro",
    popular: true,
  },
];

function getTrialDaysLeft(trialEndsAt: string | null): number {
  if (!trialEndsAt) return 0;
  const diff = new Date(trialEndsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function StatusBanner({ status, trialEndsAt }: { status: string; trialEndsAt: string | null }) {
  const daysLeft = getTrialDaysLeft(trialEndsAt);

  if (status === "active") {
    return (
      <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
        <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0" />
        <div>
          <p className="text-white font-semibold">Subscription Active</p>
          <p className="text-gray-400 text-sm">Your gym is fully operational.</p>
        </div>
      </div>
    );
  }

  if (status === "trialing" && daysLeft > 0) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3 bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
          <Clock className="h-5 w-5 text-blue-400 shrink-0" />
          <div className="flex-1">
            <p className="text-white font-semibold">Free Trial Active</p>
            <p className="text-gray-400 text-sm">{daysLeft} day{daysLeft !== 1 ? "s" : ""} remaining. Subscribe before your trial ends to keep your gym running.</p>
          </div>
        </div>
        <div className="bg-[#1a1a1a] rounded-lg p-3">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Trial progress</span>
            <span>{30 - daysLeft} of 30 days used</span>
          </div>
          <div className="h-2 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all"
              style={{ width: `${((30 - daysLeft) / 30) * 100}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  if (status === "trialing" || status === "trial_expired") {
    return (
      <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-lg p-4">
        <AlertTriangle className="h-5 w-5 text-red-400 shrink-0" />
        <div>
          <p className="text-white font-semibold">Trial Expired</p>
          <p className="text-gray-400 text-sm">Your free trial has ended. Subscribe to a plan below to restore access to your gym.</p>
        </div>
      </div>
    );
  }

  if (status === "past_due") {
    return (
      <div className="flex items-center gap-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
        <AlertTriangle className="h-5 w-5 text-yellow-400 shrink-0" />
        <div>
          <p className="text-white font-semibold">Payment Failed</p>
          <p className="text-gray-400 text-sm">Your last payment failed. Update your payment method to restore access.</p>
        </div>
      </div>
    );
  }

  if (status === "canceled") {
    return (
      <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-lg p-4">
        <XCircle className="h-5 w-5 text-red-400 shrink-0" />
        <div>
          <p className="text-white font-semibold">Subscription Canceled</p>
          <p className="text-gray-400 text-sm">Your subscription has been canceled. Subscribe to a plan to restore access.</p>
        </div>
      </div>
    );
  }

  return null;
}

export default function BillingClient() {
  const { billing } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);

  const status = billing?.subscriptionStatus || "trialing";
  const currentPriceId = billing?.stripePriceId;
  const isActive = status === "active";

  async function handleCheckout(priceId: string) {
    setLoading(priceId);
    try {
      const res = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "checkout", priceId }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      setLoading(null);
    }
  }

  async function handlePortal() {
    setLoading("portal");
    try {
      const res = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "portal" }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      setLoading(null);
    }
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-3 mb-2">
        <CreditCard className="h-6 w-6 text-brand-accent" />
        <h1 className="text-2xl font-bold text-white">Billing</h1>
      </div>
      <p className="text-gray-400 mb-6">Manage your gym&apos;s subscription and billing.</p>

      <StatusBanner status={status} trialEndsAt={billing?.trialEndsAt || null} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        {PLANS.map((plan) => {
          const isCurrent = isActive && currentPriceId === plan.priceId;
          return (
            <div
              key={plan.name}
              className={`bg-[#1a1a1a] border rounded-lg p-6 relative ${
                plan.popular ? "border-brand-accent" : "border-white/10"
              } ${isCurrent ? "ring-2 ring-brand-accent" : ""}`}
            >
              {plan.popular && (
                <span className="text-xs font-bold text-brand-accent uppercase tracking-wider mb-2 block">
                  Most Popular
                </span>
              )}
              {isCurrent && (
                <span className="absolute top-4 right-4 bg-brand-accent text-black text-xs font-bold px-2 py-1 rounded">
                  Current Plan
                </span>
              )}
              <h2 className="text-xl font-bold text-white">{plan.name}</h2>
              <div className="mt-2">
                <span className="text-3xl font-bold text-brand-accent">{plan.price}</span>
                <span className="text-gray-400 text-sm">{plan.period}</span>
              </div>
              <p className="text-gray-400 text-sm mb-4">{plan.description}</p>
              <ul className="space-y-2 mb-6">
                {plan.features.map((f) => (
                  <li key={f} className="text-gray-300 text-sm flex items-center gap-2">
                    <span className="text-brand-accent">&#10003;</span> {f}
                  </li>
                ))}
              </ul>
              {isCurrent ? (
                <button
                  onClick={handlePortal}
                  disabled={!!loading}
                  className="w-full border border-white/20 text-white font-medium py-3 rounded-lg hover:bg-white/5 transition disabled:opacity-50"
                >
                  {loading === "portal" ? "Opening..." : "Manage Subscription"}
                </button>
              ) : (
                <button
                  onClick={() => handleCheckout(plan.priceId)}
                  disabled={!!loading}
                  className="w-full bg-brand-accent text-brand-black font-bold py-3 rounded-lg hover:bg-brand-accent/90 transition disabled:opacity-50"
                >
                  {loading === plan.priceId ? "Redirecting..." : isActive ? "Switch Plan" : "Subscribe"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {isActive && (
        <div className="border-t border-white/10 pt-6 mt-8">
          <button
            onClick={handlePortal}
            disabled={!!loading}
            className="text-brand-accent font-medium text-sm hover:underline disabled:opacity-50"
          >
            {loading === "portal" ? "Opening..." : "Manage billing, invoices & payment method"}
          </button>
        </div>
      )}

      <p className="text-gray-600 text-xs mt-6">
        30 day free trial for new gyms. Cancel anytime. Prices in USD.
      </p>
    </div>
  );
}
