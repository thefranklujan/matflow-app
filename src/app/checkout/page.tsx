"use client";

import { useCart } from "@/context/CartContext";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { BRAND } from "@/lib/constants";

export default function CheckoutPage() {
  const { items, subtotal, clearCart } = useCart();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    notes: "",
  });

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  if (items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <h1 className="text-3xl font-bold text-white mb-4">Checkout</h1>
        <p className="text-gray-400 mb-8">Your cart is empty.</p>
        <Link
          href="/products"
          className="inline-block bg-brand-teal text-brand-black font-bold px-6 py-3 rounded-lg hover:bg-brand-teal/90 transition"
        >
          Start Shopping
        </Link>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: form.customerName,
          customerEmail: form.customerEmail,
          customerPhone: form.customerPhone || undefined,
          notes: form.notes || undefined,
          items: items.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
            unitPrice: item.price,
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to place order");
      }

      const order = await res.json();
      clearCart();
      router.push(`/checkout/confirmation?orderId=${order.id}`);
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-4">
        <Link href="/cart" className="text-gray-400 hover:text-white transition text-sm">
          &larr; Back to Cart
        </Link>
      </div>
      <h1 className="text-3xl font-bold text-white mb-8">Checkout</h1>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Customer Info */}
        <div className="space-y-6">
          <div className="bg-brand-dark border border-brand-gray rounded-lg p-6">
            <h2 className="text-lg font-bold text-white mb-4">Your Information</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Name *</label>
                <input
                  type="text"
                  value={form.customerName}
                  onChange={(e) => update("customerName", e.target.value)}
                  className="w-full px-4 py-3 bg-brand-black border border-brand-gray rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-brand-teal transition"
                  placeholder="Your full name"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Email *</label>
                <input
                  type="email"
                  value={form.customerEmail}
                  onChange={(e) => update("customerEmail", e.target.value)}
                  className="w-full px-4 py-3 bg-brand-black border border-brand-gray rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-brand-teal transition"
                  placeholder="your@email.com"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Phone</label>
                <input
                  type="tel"
                  value={form.customerPhone}
                  onChange={(e) => update("customerPhone", e.target.value)}
                  className="w-full px-4 py-3 bg-brand-black border border-brand-gray rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-brand-teal transition"
                  placeholder="(optional)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => update("notes", e.target.value)}
                  className="w-full px-4 py-3 bg-brand-black border border-brand-gray rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-brand-teal transition resize-none"
                  rows={3}
                  placeholder="Any special requests (optional)"
                />
              </div>
            </div>
          </div>

          <div className="bg-brand-black border border-brand-gray rounded-lg p-4">
            <p className="text-gray-300 text-sm font-medium mb-2">
              Payment collected at pickup or by arrangement
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
        </div>

        {/* Order Summary */}
        <div>
          <div className="bg-brand-dark border border-brand-gray rounded-lg p-6 sticky top-4">
            <h2 className="text-lg font-bold text-white mb-4">Order Summary</h2>
            <div className="space-y-3 mb-4">
              {items.map((item) => (
                <div key={item.variantId} className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{item.name}</p>
                    <p className="text-gray-500 text-xs">
                      {item.size}{item.color ? ` / ${item.color}` : ""} &times; {item.quantity}
                    </p>
                  </div>
                  <p className="text-white text-sm font-medium flex-shrink-0">
                    {formatCurrency(item.price * item.quantity)}
                  </p>
                </div>
              ))}
            </div>

            <div className="border-t border-brand-gray pt-4 mb-6">
              <div className="flex items-center justify-between">
                <span className="text-lg text-gray-300">Total</span>
                <span className="text-2xl font-bold text-brand-teal">{formatCurrency(subtotal)}</span>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-sm mb-4">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-teal text-brand-black font-bold py-3 rounded-lg hover:bg-brand-teal/90 transition disabled:opacity-50"
            >
              {loading ? "Placing Order..." : "Place Order"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
