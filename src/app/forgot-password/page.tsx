"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Something went wrong");
        setLoading(false);
        return;
      }
      setSent(true);
    } catch {
      setError("Network error. Try again.");
    }
    setLoading(false);
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-[#080808] px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="MatFlow" className="mx-auto mb-4 h-16 w-auto" />
          <p className="text-gray-400">Reset your password</p>
        </div>

        {sent ? (
          <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-8 text-center space-y-4">
            <h2 className="text-xl font-bold text-white">Check your email</h2>
            <p className="text-gray-400 text-sm">
              If an account exists for <span className="text-white">{email}</span>, we just sent a
              reset link. It expires in 1 hour.
            </p>
            <p className="text-gray-500 text-xs">
              Didn&apos;t get it? Check spam, or&nbsp;
              <button
                onClick={() => setSent(false)}
                className="text-[#dc2626] hover:underline"
              >
                try a different email
              </button>
              .
            </p>
            <Link
              href="/sign-in"
              className="inline-block mt-4 text-[#dc2626] hover:underline text-sm"
            >
              Back to sign in
            </Link>
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

            <p className="text-gray-400 text-sm">
              Enter the email on your MatFlow account. We&apos;ll send you a link to pick a new
              password.
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="you@yourgym.com"
                className="w-full px-4 py-3 bg-black border border-white/10 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-[#dc2626] transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#dc2626] hover:bg-[#b91c1c] text-white font-bold py-3 rounded-lg transition disabled:opacity-50"
            >
              {loading ? "Sending..." : "Send reset link"}
            </button>

            <p className="text-center text-gray-500 text-sm">
              Remembered it?{" "}
              <Link href="/sign-in" className="text-[#dc2626] hover:underline">
                Sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
