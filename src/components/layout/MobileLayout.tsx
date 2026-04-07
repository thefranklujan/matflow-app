"use client";

import { MobileHeader } from "./MobileHeader";
import { MobileTabBar } from "./MobileTabBar";

export function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col min-h-0">
      <MobileHeader />
      <main className="flex-1 overflow-y-auto pb-20">{children}</main>
      <MobileTabBar />
    </div>
  );
}
