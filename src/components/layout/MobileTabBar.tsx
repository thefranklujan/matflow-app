"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { MOBILE_TABS } from "@/lib/nav-items";
import { MobileMoreMenu } from "./MobileMoreMenu";
import { cn } from "@/lib/utils";
import { Home, Calendar, TrendingUp, BarChart3, Menu } from "lucide-react";

const TAB_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Home, Calendar, TrendingUp, BarChart3,
};

export function MobileTabBar() {
  const pathname = usePathname();
  const { role } = useAuth();
  const [showMore, setShowMore] = useState(false);

  const visibleTabs = MOBILE_TABS.filter((tab) => role && tab.roles.includes(role));

  return (
    <>
      <nav className="shrink-0 z-50 border-t border-white/10 bg-[#0a0a0a] pb-[env(safe-area-inset-bottom)]">
        <div className="flex h-16 items-stretch">
          {visibleTabs.map((tab) => {
            const Icon = TAB_ICONS[tab.icon] || Home;
            const href = tab.slug ? `/app/${tab.slug}` : "/app";
            const isActive = tab.slug
              ? pathname.startsWith(`/app/${tab.slug}`)
              : pathname === "/app";

            return (
              <Link
                key={tab.slug || "home"}
                href={href}
                className={cn(
                  "flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors",
                  isActive ? "text-[#c4b5a0]" : "text-gray-500"
                )}
              >
                <Icon className={cn("h-5 w-5", isActive && "text-[#c4b5a0]")} />
                {tab.label}
              </Link>
            );
          })}
          <button
            onClick={() => setShowMore(true)}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors",
              showMore ? "text-[#c4b5a0]" : "text-gray-500"
            )}
          >
            <Menu className="h-5 w-5" />
            More
          </button>
        </div>
      </nav>

      {showMore && <MobileMoreMenu onClose={() => setShowMore(false)} />}
    </>
  );
}
