"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function StudentSignUpPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/student-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Sign up failed");
        setLoading(false);
        return;
      }

      try { await (window as unknown as { __matflowStashNativeAuth?: () => Promise<void> }).__matflowStashNativeAuth?.(); } catch {}

      router.push("/student");
    } catch {
      setError("Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#080808] px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="MatFlow" className="mx-auto mb-4 h-16 w-auto" />
          <h1 className="text-gray-400 text-base font-normal">Student Companion App</h1>
          <p className="text-gray-400 text-xs mt-2 uppercase tracking-wider">Create your student account</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-[#111] border border-white/10 rounded-xl p-8 space-y-5"
        >
          {error && (
            <div
              id="student-signup-error"
              role="alert"
              className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm"
            >
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="student-first-name" className="block text-sm font-medium text-gray-300 mb-1.5">
                First Name
              </label>
              <input
                id="student-first-name"
                name="given-name"
                autoComplete="given-name"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-4 py-3 bg-black border border-white/10 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-[#dc2626] transition"
                placeholder="Riley"
                required
              />
            </div>
            <div>
              <label htmlFor="student-last-name" className="block text-sm font-medium text-gray-300 mb-1.5">
                Last Name
              </label>
              <input
                id="student-last-name"
                name="family-name"
                autoComplete="family-name"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full px-4 py-3 bg-black border border-white/10 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-[#dc2626] transition"
                placeholder="Park"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="student-email" className="block text-sm font-medium text-gray-300 mb-1.5">
              Email
            </label>
            <input
              id="student-email"
              name="email"
              autoComplete="email"
              inputMode="email"
              type="email"
              aria-describedby={error ? "student-signup-error" : undefined}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-black border border-white/10 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-[#dc2626] transition"
              placeholder="you@email.com"
              required
            />
          </div>

          <div>
            <label htmlFor="student-password" className="block text-sm font-medium text-gray-300 mb-1.5">
              Password
            </label>
            <input
              id="student-password"
              name="new-password"
              autoComplete="new-password"
              type="password"
              aria-describedby={error ? "student-signup-error" : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-black border border-white/10 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-[#dc2626] transition"
              placeholder="Min 6 characters"
              minLength={6}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#dc2626] hover:bg-[#b91c1c] text-white font-bold py-3 rounded-lg transition disabled:opacity-50"
          >
            {loading ? "Creating account..." : "Create Student Account"}
          </button>

          <p className="text-center text-gray-400 text-sm">
            Already have an account?{" "}
            <Link href="/sign-in" className="text-[#ef4444] underline">
              Sign in
            </Link>
          </p>
        </form>

        <p className="text-center text-gray-400 text-xs mt-6">
          Free forever for students. No credit card required.
        </p>
      </div>
    </div>
  );
}
