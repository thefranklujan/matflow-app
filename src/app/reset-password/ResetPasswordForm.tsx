"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

export default function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Reset failed");
        setLoading(false);
        return;
      }
      setDone(true);
      setTimeout(() => router.push("/sign-in"), 1800);
    } catch {
      setError("Network error. Try again.");
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-[#080808] px-4 py-12">
        <div className="w-full max-w-md text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="MatFlow" className="mx-auto mb-4 h-16 w-auto" />
          <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-8 space-y-4">
            <h2 className="text-xl font-bold text-white">Reset link invalid</h2>
            <p className="text-gray-400 text-sm">
              This reset link is missing a token. Request a new one to continue.
            </p>
            <Link
              href="/forgot-password"
              className="inline-block bg-[#dc2626] hover:bg-[#b91c1c] text-white font-bold py-2.5 px-5 rounded-lg transition"
            >
              Request a new link
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-[#080808] px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="MatFlow" className="mx-auto mb-4 h-16 w-auto" />
          <p className="text-gray-400">Pick a new password</p>
        </div>

        {done ? (
          <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-8 text-center space-y-3">
            <h2 className="text-xl font-bold text-white">Password updated</h2>
            <p className="text-gray-400 text-sm">
              You can sign in with your new password now. Taking you there...
            </p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="bg-[#0a0a0a] border border-white/10 rounded-xl p-8 space-y-5"
          >
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">New password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="At least 6 characters"
                className="w-full px-4 py-3 bg-black border border-white/10 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-[#dc2626] transition"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Confirm password
              </label>
              <input
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                placeholder="Type it again"
                className="w-full px-4 py-3 bg-black border border-white/10 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-[#dc2626] transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#dc2626] hover:bg-[#b91c1c] text-white font-bold py-3 rounded-lg transition disabled:opacity-50"
            >
              {loading ? "Updating..." : "Update password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
