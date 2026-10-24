"use client";

import WaiverPanel from "@/components/waiver/WaiverPanel";

export default function MemberWaiverPage() {
  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-bold text-white mb-4">Waiver</h1>
      <WaiverPanel endpoint="/api/members/waiver" compact={false} />
    </div>
  );
}
