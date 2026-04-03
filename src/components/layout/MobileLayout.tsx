"use client";

import { MobileHeader } from "./MobileHeader";
import { MobileTabBar } from "./MobileTabBar";

export function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen flex-col">
      <MobileHeader />
      <main className="flex-1 overflow-y-auto pb-20">{children}</main>
      <MobileTabBar />
    </div>
  );
}
