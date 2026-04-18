"use client";

import { MobileHeader } from "./MobileHeader";
import { MobileTabBar } from "./MobileTabBar";

/**
 * App-shell layout for the gym-owner portal on mobile.
 *
 * Fully bounded flex column — parent fills available height, main is the
 * only scrollable region (with overscroll-contain so iOS rubber-band
 * bounce never propagates to the page), and MobileTabBar is an in-flow
 * flex child (NOT position:fixed) so the nav is physically pinned to the
 * bottom without depending on viewport positioning.
 */
export function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
      <MobileHeader />
      <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">
        {children}
      </main>
      <MobileTabBar />
    </div>
  );
}
