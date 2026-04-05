"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login failed");
        setLoading(false);
        return;
      }

      if (data.isPlatformAdmin) {
        router.push("/platform");
      } else {
        router.push("/app");
      }
    } catch {
      setError("Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-black px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">MatFlow</h1>
          <p className="text-gray-400">Sign in to your account</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-brand-dark border border-brand-gray rounded-lg p-8 space-y-6"
        >
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-brand-black border border-brand-gray rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-brand-accent transition"
              placeholder="you@yourgym.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-brand-black border border-brand-gray rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-brand-accent transition"
              placeholder="Enter password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-accent text-brand-black font-bold py-3 rounded-lg hover:bg-brand-accent/90 transition disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>

          <p className="text-center text-gray-500 text-sm">
            Don&apos;t have an account?{" "}
            <Link href="/sign-up" className="text-brand-accent hover:underline">
              Start free trial
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
