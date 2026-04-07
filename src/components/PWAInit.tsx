"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function PWAInit() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstall, setShowInstall] = useState(false);

  useEffect(() => {
    // Register service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    // Listen for install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
      // Only show if not dismissed before
      if (localStorage.getItem("matflow-install-dismissed") !== "true") {
        setTimeout(() => setShowInstall(true), 5000);
      }
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function install() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const result = await installPrompt.userChoice;
    if (result.outcome === "accepted") {
      setShowInstall(false);
    }
  }

  function dismiss() {
    localStorage.setItem("matflow-install-dismissed", "true");
    setShowInstall(false);
  }

  if (!showInstall || !installPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-sm bg-[#111] border border-white/10 rounded-xl p-4 shadow-2xl z-50">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-lg bg-[#c4b5a0]/10 flex items-center justify-center text-[#c4b5a0] font-bold">M</div>
        <div className="flex-1">
          <p className="text-white font-semibold text-sm">Install MatFlow</p>
          <p className="text-gray-500 text-xs mt-0.5">Add to your home screen for the full app experience</p>
        </div>
        <button onClick={dismiss} className="text-gray-600 hover:text-white text-xl leading-none">&times;</button>
      </div>
      <div className="flex gap-2 mt-3">
        <button onClick={dismiss} className="flex-1 px-3 py-2 text-gray-400 hover:text-white text-sm">Not now</button>
        <button onClick={install} className="flex-1 px-3 py-2 bg-[#c4b5a0] text-black text-sm font-bold rounded-lg">Install</button>
      </div>
    </div>
  );
}
