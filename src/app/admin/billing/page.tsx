"use client";

import { useState } from "react";

const PLANS = [
  {
    name: "Basic",
    price: "$49/mo",
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
    price: "$99/mo",
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

export default function BillingPage() {
  const [loading, setLoading] = useState<string | null>(null);

  async function handleCheckout(priceId: string) {
    setLoading(priceId);
    try {
      const res = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "checkout", priceId }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
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
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setLoading(null);
    }
  }

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-bold text-white mb-2">Billing</h1>
      <p className="text-gray-400 mb-8">Choose a plan to keep your gym running on MatFlow.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {PLANS.map((plan) => (
          <div
            key={plan.name}
            className={`bg-brand-dark border rounded-lg p-6 ${
              plan.popular ? "border-brand-accent" : "border-brand-gray"
            }`}
          >
            {plan.popular && (
              <span className="text-xs font-bold text-brand-accent uppercase tracking-wider mb-2 block">
                Most Popular
              </span>
            )}
            <h2 className="text-xl font-bold text-white">{plan.name}</h2>
            <p className="text-3xl font-bold text-brand-accent mt-2">{plan.price}</p>
            <p className="text-gray-400 text-sm mb-4">{plan.description}</p>
            <ul className="space-y-2 mb-6">
              {plan.features.map((f) => (
                <li key={f} className="text-gray-300 text-sm flex items-center gap-2">
                  <span className="text-brand-accent">&#10003;</span> {f}
                </li>
              ))}
            </ul>
            <button
              onClick={() => handleCheckout(plan.priceId)}
              disabled={!!loading}
              className="w-full bg-brand-accent text-brand-black font-bold py-3 rounded-lg hover:bg-brand-accent/90 transition disabled:opacity-50"
            >
              {loading === plan.priceId ? "Redirecting..." : "Subscribe"}
            </button>
          </div>
        ))}
      </div>

      <div className="border-t border-brand-gray pt-6">
        <p className="text-gray-400 text-sm mb-3">Already subscribed?</p>
        <button
          onClick={handlePortal}
          disabled={!!loading}
          className="text-brand-accent font-medium text-sm hover:underline disabled:opacity-50"
        >
          {loading === "portal" ? "Opening..." : "Manage billing & invoices"}
        </button>
      </div>

      <p className="text-gray-600 text-xs mt-6">
        All plans include a 14-day free trial. Cancel anytime.
      </p>
    </div>
  );
}
