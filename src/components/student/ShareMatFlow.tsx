"use client";

import { useState } from "react";
import { Share2, X, Copy, Check, MessageCircle, Mail, QrCode } from "lucide-react";

const SHARE_TEXT = "I'm using MatFlow to track my jiu-jitsu training, find gyms, and connect with my community. Join me:";

export default function ShareMatFlow({ studentId, variant = "button" }: { studentId?: string; variant?: "button" | "card" }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const inviteUrl = typeof window !== "undefined"
    ? `${window.location.origin}/student/sign-up${studentId ? `?ref=${studentId}` : ""}`
    : `https://app.mymatflow.com/student/sign-up${studentId ? `?ref=${studentId}` : ""}`;

  const fullText = `${SHARE_TEXT} ${inviteUrl}`;

  async function nativeShare() {
    if (typeof navigator !== "undefined" && (navigator as Navigator & { share?: (data: ShareData) => Promise<void> }).share) {
      try {
        await (navigator as Navigator & { share: (data: ShareData) => Promise<void> }).share({
          title: "MatFlow",
          text: SHARE_TEXT,
          url: inviteUrl,
        });
      } catch {}
    } else {
      copy();
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(inviteUrl)}&bgcolor=0a0a0a&color=ffffff&margin=10`;

  return (
    <>
      {variant === "card" ? (
        <button
          onClick={() => setOpen(true)}
          className="w-full bg-gradient-to-br from-[#dc2626]/20 to-[#dc2626]/5 border border-[#dc2626]/30 rounded-xl p-4 text-left hover:from-[#dc2626]/30 hover:to-[#dc2626]/10 transition group"
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-[#dc2626]/20 flex items-center justify-center shrink-0">
              <Share2 className="h-5 w-5 text-[#dc2626]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm">Share MatFlow</p>
              <p className="text-gray-400 text-xs">Invite training partners to join your community</p>
            </div>
          </div>
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:bg-white/5 hover:text-white transition w-full"
        >
          <Share2 className="h-4 w-4 shrink-0" />
          <span>Share MatFlow</span>
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-xl font-bold text-white">Share MatFlow</h2>
              <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-gray-500 text-sm mb-5">Invite your training partners. They sign up free.</p>

            {showQR ? (
              <div className="text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrUrl} alt="QR code" className="mx-auto rounded-lg border border-white/10" />
                <p className="text-gray-500 text-xs mt-3">Have them point a phone camera at this</p>
                <button onClick={() => setShowQR(false)} className="text-gray-400 hover:text-white text-sm mt-3">Back</button>
              </div>
            ) : (
              <>
                {/* Invite link */}
                <div className="bg-black border border-white/10 rounded-lg p-3 mb-4 flex items-center gap-2">
                  <p className="text-gray-300 text-xs flex-1 truncate font-mono">{inviteUrl}</p>
                  <button onClick={copy} className="shrink-0 bg-white/5 hover:bg-white/10 text-white text-xs font-semibold px-3 py-1.5 rounded-md flex items-center gap-1.5">
                    {copied ? <><Check className="h-3 w-3" /> Copied</> : <><Copy className="h-3 w-3" /> Copy</>}
                  </button>
                </div>

                {/* Native share (mobile) */}
                <button onClick={nativeShare} className="w-full bg-[#dc2626] hover:bg-[#b91c1c] text-white font-semibold py-3 rounded-lg mb-3 flex items-center justify-center gap-2">
                  <Share2 className="h-4 w-4" /> Share
                </button>

                {/* Quick links */}
                <div className="grid grid-cols-4 gap-2">
                  <a href={`sms:?&body=${encodeURIComponent(fullText)}`} className="flex flex-col items-center gap-1 bg-white/5 hover:bg-white/10 rounded-lg p-3 text-xs text-gray-300">
                    <MessageCircle className="h-5 w-5" />
                    iMessage
                  </a>
                  <a href={`https://wa.me/?text=${encodeURIComponent(fullText)}`} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-1 bg-white/5 hover:bg-white/10 rounded-lg p-3 text-xs text-gray-300">
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    WhatsApp
                  </a>
                  <a href={`mailto:?subject=${encodeURIComponent("Try MatFlow")}&body=${encodeURIComponent(fullText)}`} className="flex flex-col items-center gap-1 bg-white/5 hover:bg-white/10 rounded-lg p-3 text-xs text-gray-300">
                    <Mail className="h-5 w-5" />
                    Email
                  </a>
                  <button onClick={() => setShowQR(true)} className="flex flex-col items-center gap-1 bg-white/5 hover:bg-white/10 rounded-lg p-3 text-xs text-gray-300">
                    <QrCode className="h-5 w-5" />
                    QR Code
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
