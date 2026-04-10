"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Building2, Users, Megaphone, Flame, Mail, Activity, Database, ShieldCheck } from "lucide-react";

const tabs = [
  { href: "/platform", label: "Dashboard", icon: LayoutDashboard },
  { href: "/platform/activity", label: "Activity", icon: Activity },
  { href: "/platform/gyms", label: "Gyms", icon: Building2 },
  { href: "/platform/students", label: "Students", icon: Users },
  { href: "/platform/nominations", label: "Nominations", icon: Flame },
  { href: "/platform/campaigns", label: "Campaigns", icon: Mail },
  { href: "/platform/broadcast", label: "Broadcast", icon: Megaphone },
  { href: "/platform/database", label: "Database", icon: Database },
  { href: "/platform/approve-gyms", label: "Approve Gyms", icon: ShieldCheck },
];

export default function PlatformNav() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-white/10 bg-[#0a0a0a] px-6">
      <div className="max-w-7xl mx-auto flex items-center gap-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.href === "/platform"
            ? pathname === "/platform"
            : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition ${
                isActive
                  ? "border-orange-500 text-orange-400"
                  : "border-transparent text-gray-400 hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
