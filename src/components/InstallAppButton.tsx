"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function InstallAppButton() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [showIOSHelp, setShowIOSHelp] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Already running as installed PWA
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) {
      setInstalled(true);
      return;
    }

    // iOS detection (Safari does not fire beforeinstallprompt)
    const ua = window.navigator.userAgent;
    const iOS = /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
    setIsIOS(iOS);

    function onPrompt(e: Event) {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    }
    function onInstalled() {
      setInstalled(true);
      setDeferred(null);
    }

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  // iOS path: no native prompt, show instructions
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSHelp(true)}
          className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-[#0fe69b] text-black text-xs font-semibold px-3 py-1.5 hover:bg-[#0fe69b]/90 transition"
        >
          <Download className="h-3.5 w-3.5" />
          Install App
        </button>
        {showIOSHelp && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4">
            <div className="max-w-sm w-full rounded-xl bg-[#141414] border border-white/10 p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-bold text-lg">Install MatFlow</h3>
                <button onClick={() => setShowIOSHelp(false)} className="text-gray-400 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <ol className="text-sm text-gray-300 space-y-2.5 list-decimal list-inside">
                <li>Tap the Share button at the bottom of Safari</li>
                <li>Scroll down and tap &ldquo;Add to Home Screen&rdquo;</li>
                <li>Tap Add in the top right</li>
              </ol>
              <p className="text-xs text-gray-500 mt-4">
                MatFlow will open like a native app and send you push notifications.
              </p>
            </div>
          </div>
        )}
      </>
    );
  }

  // Desktop / Android path: use native prompt when available
  if (!deferred) return null;

  async function handleInstall() {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") {
      setInstalled(true);
    }
    setDeferred(null);
  }

  return (
    <button
      onClick={handleInstall}
      className="inline-flex items-center gap-1.5 rounded-lg bg-[#0fe69b] text-black text-xs font-semibold px-3 py-1.5 hover:bg-[#0fe69b]/90 transition"
    >
      <Download className="h-3.5 w-3.5" />
      Install App
    </button>
  );
}
