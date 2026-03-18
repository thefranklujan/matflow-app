"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useCart } from "@/context/CartContext";

export default function Navbar() {
  const { itemCount } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 bg-brand-black/95 backdrop-blur border-b border-brand-gray">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center">
            <Image
              src="/logo-white.svg"
              alt="Ceconi BJJ"
              width={180}
              height={54}
              className="h-12 w-auto"
              priority
            />
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            <Link href="/" className="text-sm font-medium text-gray-300 hover:text-brand-teal transition uppercase tracking-wider">
              Home
            </Link>
            <Link href="/products" className="text-sm font-medium text-gray-300 hover:text-brand-teal transition uppercase tracking-wider">
              Shop
            </Link>
            <div className="relative group">
              <button className="text-sm font-medium text-gray-300 hover:text-brand-teal transition uppercase tracking-wider">
                Categories
              </button>
              <div className="absolute top-full left-0 mt-2 w-48 bg-brand-dark border border-brand-gray rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                <div className="py-2">
                  {["Gis", "Rash Guards", "Shorts", "T-Shirts", "Hoodies", "Belts", "Patches", "Accessories"].map(
                    (cat) => (
                      <Link
                        key={cat}
                        href={`/categories/${cat.toLowerCase().replace(/\s+/g, "-")}`}
                        className="block px-4 py-2 text-sm text-gray-300 hover:text-brand-teal hover:bg-brand-gray/50 transition"
                      >
                        {cat}
                      </Link>
                    )
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Cart + Member Login + Mobile Menu */}
          <div className="flex items-center gap-3">
            <Link href="/cart" className="relative p-2 text-gray-300 hover:text-brand-teal transition">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
              </svg>
              {itemCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-brand-teal text-brand-black text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                  {itemCount}
                </span>
              )}
            </Link>

            <Link
              href="/members/login"
              className="hidden sm:inline-block bg-brand-teal text-brand-black text-xs font-bold px-4 py-2 rounded uppercase tracking-wider hover:bg-brand-teal/90 transition"
            >
              Member Login
            </Link>

            {/* Mobile hamburger */}
            <button
              className="md:hidden p-2 text-gray-300"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {menuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden pb-4 border-t border-brand-gray mt-2 pt-4">
            <Link href="/" className="block py-2 text-gray-300 hover:text-brand-teal uppercase tracking-wider text-sm font-medium" onClick={() => setMenuOpen(false)}>
              Home
            </Link>
            <Link href="/products" className="block py-2 text-gray-300 hover:text-brand-teal uppercase tracking-wider text-sm font-medium" onClick={() => setMenuOpen(false)}>
              Shop All
            </Link>
            <Link href="/members/login" className="inline-block mt-2 mb-2 bg-brand-teal text-brand-black text-xs font-bold px-4 py-2 rounded uppercase tracking-wider hover:bg-brand-teal/90 transition" onClick={() => setMenuOpen(false)}>
              Member Login
            </Link>
            {["Gis", "Rash Guards", "Shorts", "T-Shirts", "Hoodies", "Belts", "Patches", "Accessories"].map(
              (cat) => (
                <Link
                  key={cat}
                  href={`/categories/${cat.toLowerCase().replace(/\s+/g, "-")}`}
                  className="block py-2 pl-4 text-sm text-gray-400 hover:text-brand-teal"
                  onClick={() => setMenuOpen(false)}
                >
                  {cat}
                </Link>
              )
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
