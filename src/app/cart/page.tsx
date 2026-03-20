"use client";

import { useCart } from "@/context/CartContext";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";


export default function CartPage() {
  const { items, removeItem, updateQuantity, clearCart, subtotal } = useCart();

  if (items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <h1 className="text-3xl font-bold text-white mb-4">Your Cart</h1>
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

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-white">Your Cart</h1>
        <button
          onClick={clearCart}
          className="text-sm text-gray-400 hover:text-red-400 transition"
        >
          Clear Cart
        </button>
      </div>

      <div className="space-y-4 mb-8">
        {items.map((item) => (
          <div
            key={item.variantId}
            className="flex items-center gap-4 bg-brand-dark border border-brand-gray rounded-lg p-4"
          >
            {/* Image */}
            <div className="w-20 h-20 bg-brand-gray rounded-lg flex-shrink-0 overflow-hidden">
              {item.image ? (
                <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-gray-600 text-2xl">🥋</span>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <Link href={`/products/${item.slug}`} className="text-white font-semibold hover:text-brand-teal transition">
                {item.name}
              </Link>
              <div className="flex items-center gap-2 text-sm text-gray-400 mt-1">
                <span>{item.size}</span>
                {item.color && (
                  <>
                    <span>/</span>
                    <span>{item.color}</span>
                  </>
                )}
              </div>
              <p className="text-brand-teal font-bold mt-1">{formatCurrency(item.price)}</p>
            </div>

            {/* Quantity */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
                className="w-8 h-8 rounded border border-brand-gray text-gray-300 hover:border-gray-500 transition text-sm"
              >
                -
              </button>
              <span className="w-8 text-center text-white text-sm">{item.quantity}</span>
              <button
                onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
                className="w-8 h-8 rounded border border-brand-gray text-gray-300 hover:border-gray-500 transition text-sm"
              >
                +
              </button>
            </div>

            {/* Line total */}
            <div className="text-right w-24">
              <p className="text-white font-bold">{formatCurrency(item.price * item.quantity)}</p>
            </div>

            {/* Remove */}
            <button
              onClick={() => removeItem(item.variantId)}
              className="text-gray-500 hover:text-red-400 transition p-1"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="bg-brand-dark border border-brand-gray rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <span className="text-lg text-gray-300">Subtotal</span>
          <span className="text-2xl font-bold text-brand-teal">{formatCurrency(subtotal)}</span>
        </div>

        <p className="text-gray-500 text-xs mb-4">
          Payment collected at pickup or by arrangement.
        </p>

        <Link
          href="/checkout"
          className="block text-center bg-brand-teal text-brand-black font-bold py-3 rounded-lg hover:bg-brand-teal/90 transition mb-3"
        >
          Proceed to Checkout
        </Link>

        <Link
          href="/products"
          className="block text-center text-gray-400 hover:text-white text-sm transition"
        >
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}
