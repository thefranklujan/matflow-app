"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BRAND } from "@/lib/constants";
import { Suspense } from "react";

function ConfirmationContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");
  const orderNumber = orderId ? orderId.slice(-8).toUpperCase() : "N/A";

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
      <div className="bg-brand-dark border border-brand-gray rounded-lg p-8">
        <div className="text-5xl mb-4">🥋</div>
        <h1 className="text-3xl font-bold text-white mb-2">Order Received!</h1>
        <p className="text-gray-400 mb-6">
          Thank you for your order. Your order number is:
        </p>
        <p className="text-2xl font-bold text-brand-teal mb-6">#{orderNumber}</p>

        <div className="bg-brand-black border border-brand-gray rounded-lg p-4 mb-6 text-left">
          <p className="text-gray-300 text-sm font-medium mb-2">
            Payment will be collected at pickup or by arrangement
          </p>
          {BRAND.locations.map((loc) => (
            <p key={loc.name} className="text-sm text-gray-400">
              <span className="text-brand-teal font-medium">{loc.name}:</span> {loc.address}
            </p>
          ))}
          <p className="text-sm text-gray-400 mt-2">
            Call us: <span className="text-brand-teal">{BRAND.phone}</span>
          </p>
        </div>

        <Link
          href="/products"
          className="inline-block bg-brand-teal text-brand-black font-bold px-6 py-3 rounded-lg hover:bg-brand-teal/90 transition"
        >
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}

export default function CheckoutConfirmationPage() {
  return (
    <Suspense fallback={<div className="text-center py-16 text-gray-400">Loading...</div>}>
      <ConfirmationContent />
    </Suspense>
  );
}
