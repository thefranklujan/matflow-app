"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

function SignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const joinSlug = searchParams.get("join");
  const [step, setStep] = useState(1);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [gymName, setGymName] = useState("");
  const [gymSlug, setGymSlug] = useState("");
  const [timezone, setTimezone] = useState("America/Chicago");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleGymNameChange(value: string) {
    setGymName(value);
    setGymSlug(
      value
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/--+/g, "-")
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (step === 1) {
      if (!firstName || !lastName || !email || !password) {
        setError("All fields are required");
        return;
      }
      if (password.length < 6) {
        setError("Password must be at least 6 characters");
        return;
      }
      setError("");

      // If joining a gym, submit directly (no step 2)
      if (joinSlug) {
        setLoading(true);
        try {
          const res = await fetch("/api/auth/join", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ firstName, lastName, email, password, gymSlug: joinSlug }),
          });
          const data = await res.json();
          if (!res.ok) {
            setError(data.error || "Registration failed");
            setLoading(false);
            return;
          }
          router.push("/app");
        } catch {
          setError("Something went wrong. Please try again.");
          setLoading(false);
        }
        return;
      }

      setStep(2);
      return;
    }

    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          password,
          gymName,
          gymSlug,
          timezone,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Registration failed");
        setLoading(false);
        return;
      }

      router.push("/app");
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-black px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">MatFlow</h1>
          <p className="text-gray-400">
            {joinSlug ? "Join your gym" : step === 1 ? "Create your account" : "Set up your gym"}
          </p>
        </div>

        {!joinSlug && (
          <div className="flex gap-2 mb-6 justify-center">
            <div className={`h-1 w-16 rounded-full ${step >= 1 ? "bg-brand-teal" : "bg-brand-gray"}`} />
            <div className={`h-1 w-16 rounded-full ${step >= 2 ? "bg-brand-teal" : "bg-brand-gray"}`} />
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="bg-brand-dark border border-brand-gray rounded-lg p-8 space-y-5"
        >
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {step === 1 ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">First Name</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full px-4 py-3 bg-brand-black border border-brand-gray rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-brand-teal transition"
                    placeholder="Marcus"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Last Name</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full px-4 py-3 bg-brand-black border border-brand-gray rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-brand-teal transition"
                    placeholder="Vega"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-brand-black border border-brand-gray rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-brand-teal transition"
                  placeholder="marcus@ironlion.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-brand-black border border-brand-gray rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-brand-teal transition"
                  placeholder="Min 6 characters"
                  minLength={6}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-brand-teal text-brand-black font-bold py-3 rounded-lg hover:bg-brand-teal/90 transition disabled:opacity-50"
              >
                {joinSlug ? (loading ? "Joining..." : "Join Gym") : "Continue"}
              </button>
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Gym Name</label>
                <input
                  type="text"
                  value={gymName}
                  onChange={(e) => handleGymNameChange(e.target.value)}
                  className="w-full px-4 py-3 bg-brand-black border border-brand-gray rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-brand-teal transition"
                  placeholder="Iron Lion Academy"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Gym URL</label>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 text-sm whitespace-nowrap">app.mymatflow.com/join/</span>
                  <input
                    type="text"
                    value={gymSlug}
                    onChange={(e) => setGymSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                    className="flex-1 px-4 py-3 bg-brand-black border border-brand-gray rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-brand-teal transition"
                    placeholder="iron-lion"
                    required
                  />
                </div>
                <p className="text-gray-600 text-xs mt-1">
                  Members will use this link to join your gym
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Timezone</label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full px-4 py-3 bg-brand-black border border-brand-gray rounded-lg text-white focus:outline-none focus:border-brand-teal transition"
                >
                  <option value="America/New_York">Eastern Time</option>
                  <option value="America/Chicago">Central Time</option>
                  <option value="America/Denver">Mountain Time</option>
                  <option value="America/Los_Angeles">Pacific Time</option>
                  <option value="America/Phoenix">Arizona Time</option>
                  <option value="Pacific/Honolulu">Hawaii Time</option>
                </select>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 border border-brand-gray text-gray-300 font-bold py-3 rounded-lg hover:bg-brand-gray/20 transition"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading || !gymName || !gymSlug}
                  className="flex-1 bg-brand-teal text-brand-black font-bold py-3 rounded-lg hover:bg-brand-teal/90 transition disabled:opacity-50"
                >
                  {loading ? "Creating..." : "Launch My Gym"}
                </button>
              </div>
            </>
          )}

          <p className="text-center text-gray-500 text-sm pt-2">
            Already have an account?{" "}
            <Link href="/sign-in" className="text-brand-teal hover:underline">
              Sign in
            </Link>
          </p>
        </form>

        <p className="text-center text-gray-600 text-xs mt-6">
          14 day free trial. No credit card required.
        </p>
      </div>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <Suspense>
      <SignUpForm />
    </Suspense>
  );
}
