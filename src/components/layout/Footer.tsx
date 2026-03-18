import Link from "next/link";
import Image from "next/image";
import { BRAND } from "@/lib/constants";

export default function Footer() {
  return (
    <footer className="bg-brand-dark border-t border-brand-gray mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div>
            <Image
              src="/square-logo.svg"
              alt="Ceconi BJJ"
              width={50}
              height={50}
              className="mb-3"
            />
            <Image
              src="/logo-white.svg"
              alt="Ceconi BJJ"
              width={160}
              height={48}
              className="mb-3 h-8 w-auto"
            />
            <p className="text-gray-400 text-sm mb-1">{BRAND.tagline}</p>
            <p className="text-gray-500 text-sm italic">&quot;{BRAND.motto}&quot;</p>
          </div>

          {/* Locations */}
          <div>
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
              Locations
            </h4>
            {BRAND.locations.map((loc) => (
              <div key={loc.name} className="mb-3">
                <p className="text-brand-teal text-sm font-medium">{loc.name}</p>
                <p className="text-gray-400 text-sm">{loc.address}</p>
              </div>
            ))}
            <p className="text-gray-400 text-sm mt-2">{BRAND.phone}</p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
              Shop
            </h4>
            <div className="space-y-2">
              <Link href="/products" className="block text-sm text-gray-400 hover:text-brand-teal transition">
                All Products
              </Link>
              {["Gis", "Rash Guards", "T-Shirts", "Hoodies"].map((cat) => (
                <Link
                  key={cat}
                  href={`/categories/${cat.toLowerCase().replace(/\s+/g, "-")}`}
                  className="block text-sm text-gray-400 hover:text-brand-teal transition"
                >
                  {cat}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-brand-gray mt-8 pt-8 text-center">
          <p className="text-gray-500 text-sm">
            &copy; {new Date().getFullYear()} {BRAND.name}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
