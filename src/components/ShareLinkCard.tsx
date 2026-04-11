"use client";

import { useState } from "react";
import { Share2, Copy, Check } from "lucide-react";

export function ShareLinkCard({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);
  const joinUrl = `https://app.mymatflow.com/join/${slug}`;

  function handleCopy() {
    navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="bg-[#1a1a1a] border border-white/10 rounded-lg" style={{ padding: "20px 24px" }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-[#c4b5a0]/10 flex items-center justify-center">
            <Share2 className="h-5 w-5 text-[#c4b5a0]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Share with your students</p>
            <p className="text-xs text-gray-500">Students who join through this link are automatically added to your gym</p>
          </div>
        </div>
        <button
          onClick={handleCopy}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
            copied
              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
              : "bg-[#c4b5a0] text-black hover:opacity-90"
          }`}
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copied" : "Copy Link"}
        </button>
      </div>
      <div className="flex items-center gap-2" style={{ marginTop: "12px" }}>
        <input
          readOnly
          value={joinUrl}
          className="flex-1 bg-[#111] border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-400 focus:outline-none"
          onClick={(e) => (e.target as HTMLInputElement).select()}
        />
      </div>
    </div>
  );
}
