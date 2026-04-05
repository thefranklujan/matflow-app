"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useCart } from "@/context/CartContext";

const categories = ["Gis", "Rash Guards", "Shorts", "T-Shirts", "Hoodies", "Belts", "Patches", "Accessories"];

export default function Navbar() {
  const { itemCount } = useCart();
  const pathname = usePathname();

  // Hide Member Login button inside the member portal (but show on login/register pages)
  const inMemberPortal =
    pathname.startsWith("/members") &&
    pathname !== "/members/login" &&
    pathname !== "/members/register";

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-brand-black/95 backdrop-blur border-b border-brand-gray">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center">
            <Image
              src="/logo-white.svg"
              alt="MatFlow"
              width={270}
              height={81}
              className="h-[72px] w-auto"
              priority
            />
          </Link>

          {/* Desktop Nav — hidden inside member portal */}
          {!inMemberPortal && (
            <div className="hidden md:flex items-center gap-8">
              <Link href="/" className="text-sm font-medium text-gray-300 hover:text-brand-accent transition uppercase tracking-wider">
                Home
              </Link>
              <Link href="/products" className="text-sm font-medium text-gray-300 hover:text-brand-accent transition uppercase tracking-wider">
                Shop
              </Link>
              <div className="relative group">
                <button className="text-sm font-medium text-gray-300 hover:text-brand-accent transition uppercase tracking-wider">
                  Categories
                </button>
                <div className="absolute top-full left-0 mt-2 w-48 bg-brand-dark border border-brand-gray rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                  <div className="py-2">
                    {categories.map((cat) => (
                      <Link
                        key={cat}
                        href={`/categories/${cat.toLowerCase().replace(/\s+/g, "-")}`}
                        className="block px-4 py-2 text-sm text-gray-300 hover:text-brand-accent hover:bg-brand-gray/50 transition"
                      >
                        {cat}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Right side: Cart + Member Login (hidden in member portal) */}
          <div className="flex items-center gap-3">
            {!inMemberPortal && (
              <>
                {/* Cart */}
                <Link href="/cart" className="relative p-2 text-gray-300 hover:text-brand-accent transition">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
                  </svg>
                  {itemCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-brand-accent text-brand-black text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                      {itemCount}
                    </span>
                  )}
                </Link>

                {/* Member Login */}
                <Link
                  href="/members/login"
                  className="bg-brand-accent text-brand-black text-xs font-bold px-3 sm:px-4 py-2 rounded uppercase tracking-wider hover:bg-brand-accent/90 transition"
                >
                  Member Login
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
