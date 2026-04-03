"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/admin", label: "Dashboard", icon: "📊" },
  { href: "/admin/analytics", label: "Analytics", icon: "📈" },
  { href: "/admin/leads", label: "Leads", icon: "🎯" },
  { href: "/admin/members", label: "Members", icon: "👥" },
  { href: "/admin/schedule", label: "Schedule", icon: "📅" },
  { href: "/admin/attendance", label: "Attendance", icon: "✅" },
  { href: "/admin/products", label: "Products", icon: "📦" },
  { href: "/admin/orders", label: "Orders", icon: "🧾" },
  { href: "/admin/inventory", label: "Inventory", icon: "📋" },
  { href: "/admin/videos", label: "Videos", icon: "🎥" },
  { href: "/admin/announcements", label: "Announcements", icon: "📢" },
  { href: "/admin/waivers", label: "Waivers", icon: "📝" },
  { href: "/admin/events", label: "Events", icon: "🎪" },
  { href: "/admin/competitions", label: "Competitions", icon: "🏆" },
  { href: "/admin/settings", label: "Settings", icon: "⚙️" },
  { href: "/admin/billing", label: "Billing", icon: "💳" },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/sign-in");
  };

  return (
    <aside className="w-64 bg-brand-dark border-r border-brand-gray hidden lg:block fixed top-[5rem] h-[calc(100vh-5rem)] overflow-hidden z-30">
      <div className="p-6">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
          Admin Panel
        </h2>
        <nav className="space-y-1">
          {links.map((link) => {
            const isActive =
              link.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition",
                  isActive
                    ? "bg-brand-teal/10 text-brand-teal border border-brand-teal/30"
                    : "text-gray-300 hover:text-white hover:bg-brand-gray/50"
                )}
              >
                <span>{link.icon}</span>
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-8 pt-4 border-t border-brand-gray space-y-2">
          <Link
            href="/"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-brand-gray/50 transition"
          >
            <span>🏪</span>
            Back to Home
          </Link>
          <button
            onClick={() => signOut()}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-red-400 hover:bg-brand-gray/50 transition w-full"
          >
            <span>🚪</span>
            Sign Out
          </button>
        </div>
      </div>
    </aside>
  );
}
