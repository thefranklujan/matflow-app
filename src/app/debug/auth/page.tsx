"use client";

import { useEffect, useState } from "react";

type BridgeState = {
  mode: "web" | "native";
  ready: boolean;
  lastRun: string;
  lastResult: string;
  lastError?: string;
  hasStoredToken?: boolean;
};

/**
 * Visible diagnostic for the iOS session-persistence bridge. Navigate to
 * /debug/auth on the device to see:
 *   - whether Capacitor native mode is detected
 *   - whether @capacitor/preferences loaded
 *   - whether a JWT is currently stashed in Preferences
 *   - what the server currently thinks about the session
 *   - manual buttons to stash / clear / restore
 *
 * Kept public so it works even when signed out.
 */
export default function AuthDebugPage() {
  const [bridge, setBridge] = useState<BridgeState | null>(null);
  const [hasToken, setHasToken] = useState<"unknown" | "yes" | "no">("unknown");
  const [serverSession, setServerSession] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState<string[]>([]);

  function note(msg: string) {
    setNotes((prev) => [`${new Date().toISOString().slice(11, 19)}  ${msg}`, ...prev].slice(0, 30));
  }

  async function refreshAll() {
    setBridge((window as unknown as { __matflowBridgeState?: BridgeState }).__matflowBridgeState || null);
    try {
      const r = await fetch("/api/auth/session", { cache: "no-store", credentials: "include" });
      setServerSession(await r.json());
    } catch {
      setServerSession({ error: "session fetch failed" });
    }
    try {
      const mod = await import("@capacitor/preferences");
      const v = await mod.Preferences.get({ key: "matflow_session_token" });
      setHasToken(v.value ? "yes" : "no");
    } catch {
      setHasToken("unknown");
    }
  }

  useEffect(() => {
    refreshAll();
    const t = setInterval(refreshAll, 2000);
    return () => clearInterval(t);
  }, []);

  async function manualStash() {
    setBusy(true);
    note("manual stash: calling __matflowStashNativeAuth");
    try {
      await (window as unknown as { __matflowStashNativeAuth?: () => Promise<void> }).__matflowStashNativeAuth?.();
      note("manual stash: done");
    } catch (e) {
      note(`manual stash error: ${e instanceof Error ? e.message : String(e)}`);
    }
    await refreshAll();
    setBusy(false);
  }

  async function manualClear() {
    setBusy(true);
    note("manual clear: calling __matflowClearNativeAuth");
    try {
      await (window as unknown as { __matflowClearNativeAuth?: () => Promise<void> }).__matflowClearNativeAuth?.();
      note("manual clear: done");
    } catch (e) {
      note(`manual clear error: ${e instanceof Error ? e.message : String(e)}`);
    }
    await refreshAll();
    setBusy(false);
  }

  async function manualRestore() {
    setBusy(true);
    try {
      const mod = await import("@capacitor/preferences");
      const v = await mod.Preferences.get({ key: "matflow_session_token" });
      if (!v.value) {
        note("manual restore: no stored token");
        setBusy(false);
        return;
      }
      note("manual restore: POSTing token to /api/auth/restore");
      const r = await fetch("/api/auth/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: v.value }),
        credentials: "include",
      });
      note(`manual restore: status ${r.status}`);
    } catch (e) {
      note(`manual restore error: ${e instanceof Error ? e.message : String(e)}`);
    }
    await refreshAll();
    setBusy(false);
  }

  return (
    <div className="min-h-[100dvh] bg-black text-white p-6 font-mono text-xs">
      <h1 className="text-lg font-bold mb-4">Auth Bridge Diagnostic</h1>

      <section className="mb-4">
        <h2 className="text-gray-400 uppercase text-[10px] tracking-wider mb-1">Bridge</h2>
        <pre className="bg-white/5 p-3 rounded text-[11px] overflow-auto whitespace-pre-wrap">
          {bridge ? JSON.stringify(bridge, null, 2) : "bridge state not populated"}
        </pre>
      </section>

      <section className="mb-4">
        <h2 className="text-gray-400 uppercase text-[10px] tracking-wider mb-1">Stored Token in Preferences</h2>
        <p
          className={`text-sm font-bold ${
            hasToken === "yes" ? "text-emerald-400" : hasToken === "no" ? "text-yellow-400" : "text-gray-400"
          }`}
        >
          {hasToken === "yes" ? "Token present" : hasToken === "no" ? "No token stashed" : "Preferences unavailable"}
        </p>
      </section>

      <section className="mb-4">
        <h2 className="text-gray-400 uppercase text-[10px] tracking-wider mb-1">Server session</h2>
        <pre className="bg-white/5 p-3 rounded text-[11px] overflow-auto whitespace-pre-wrap">
          {serverSession ? JSON.stringify(serverSession, null, 2) : "loading..."}
        </pre>
      </section>

      <section className="mb-4 flex flex-wrap gap-2">
        <button
          disabled={busy}
          onClick={manualStash}
          className="bg-[#dc2626] hover:bg-[#b91c1c] text-white font-bold px-4 py-2 rounded disabled:opacity-50"
        >
          Stash current cookie
        </button>
        <button
          disabled={busy}
          onClick={manualRestore}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded disabled:opacity-50"
        >
          Restore from Preferences
        </button>
        <button
          disabled={busy}
          onClick={manualClear}
          className="bg-white/10 hover:bg-white/20 text-white font-bold px-4 py-2 rounded disabled:opacity-50"
        >
          Clear token
        </button>
        <button
          disabled={busy}
          onClick={refreshAll}
          className="bg-white/5 hover:bg-white/10 text-gray-300 font-bold px-4 py-2 rounded disabled:opacity-50"
        >
          Refresh
        </button>
      </section>

      <section>
        <h2 className="text-gray-400 uppercase text-[10px] tracking-wider mb-1">Recent activity</h2>
        <div className="bg-white/5 p-3 rounded text-[11px] whitespace-pre-wrap">
          {notes.length ? notes.join("\n") : "(none)"}
        </div>
      </section>
    </div>
  );
}
