"use client";

import { useState } from "react";
import { AlertTriangle, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

/**
 * Danger-zone account deletion UI.
 * Required by Apple App Store Guideline 5.1.1(v) — in-app account deletion.
 *
 * Two-step flow:
 * 1. User clicks "Delete my account" → confirm modal appears
 * 2. User types DELETE and clicks confirm → account is hard-deleted
 */
export default function DeleteAccountSection() {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    if (confirm !== "DELETE") {
      toast.error("Type DELETE exactly to confirm");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/account-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: "DELETE" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Deletion failed");
        setBusy(false);
        return;
      }
      // Wipe any stashed native token so the bridge doesn't try to restore a dead session
      try { await (window as unknown as { __matflowClearNativeAuth?: () => Promise<void> }).__matflowClearNativeAuth?.(); } catch {}
      toast.success("Account deleted. You're signed out.");
      // Let the toast render, then bounce to the landing page
      setTimeout(() => {
        window.location.href = "/";
      }, 1000);
    } catch {
      toast.error("Network error. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-5">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center shrink-0">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold">Delete account</p>
          <p className="text-gray-400 text-sm mt-0.5">
            Permanently deletes your MatFlow account, training history, belt progress, and
            attendance records. This cannot be undone.
          </p>

          {!open ? (
            <button
              onClick={() => setOpen(true)}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-sm font-medium hover:bg-red-500/20 transition"
            >
              <Trash2 className="h-4 w-4" />
              Delete my account
            </button>
          ) : (
            <div className="mt-4 space-y-3">
              <p className="text-sm text-red-300">
                Type <span className="font-mono font-bold text-white">DELETE</span> below to
                confirm:
              </p>
              <input
                type="text"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="DELETE"
                className="w-full max-w-xs bg-black border border-red-500/30 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-red-500"
                autoFocus
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDelete}
                  disabled={busy || confirm !== "DELETE"}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  {busy ? "Deleting..." : "Yes, delete everything"}
                </button>
                <button
                  onClick={() => {
                    setOpen(false);
                    setConfirm("");
                  }}
                  disabled={busy}
                  className="px-4 py-2 rounded-lg text-gray-400 hover:text-white text-sm disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
