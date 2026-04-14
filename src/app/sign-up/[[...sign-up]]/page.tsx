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
  const [role, setRole] = useState<"owner" | "student" | "instructor" | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
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
      if (!firstName || !lastName || !email || !phone || !password) {
        setError("All fields are required");
        return;
      }
      if (phone.replace(/\D/g, "").length < 10) {
        setError("Please enter a valid phone number");
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
            body: JSON.stringify({ firstName, lastName, email, phone, password, gymSlug: joinSlug }),
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

    if (step === 2) {
      if (!role) {
        setError("Please choose an option");
        return;
      }
      setError("");
      if (role === "owner") {
        setStep(3);
        return;
      }
      // Student / Instructor path: register and go straight to /student
      setLoading(true);
      try {
        const res = await fetch("/api/auth/student-signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ firstName, lastName, email, phone, password, role }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Registration failed");
          setLoading(false);
          return;
        }
        router.push("/student");
      } catch {
        setError("Something went wrong. Please try again.");
        setLoading(false);
      }
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
          phone,
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="MatFlow" className="mx-auto mb-4 h-16 w-auto" />
          <p className="text-gray-400">
            {joinSlug
              ? "Join your gym"
              : step === 1
              ? "Create your account"
              : step === 2
              ? "I am signing up as..."
              : "Set up your gym"}
          </p>
        </div>

        {!joinSlug && (
          <div className="flex gap-2 mb-6 justify-center">
            <div className={`h-1 w-12 rounded-full ${step >= 1 ? "bg-brand-accent" : "bg-brand-gray"}`} />
            <div className={`h-1 w-12 rounded-full ${step >= 2 ? "bg-brand-accent" : "bg-brand-gray"}`} />
            {role !== "student" && role !== "instructor" && (
              <div className={`h-1 w-12 rounded-full ${step >= 3 ? "bg-brand-accent" : "bg-brand-gray"}`} />
            )}
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

          {step === 2 ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setRole("owner")}
                  className={`text-left p-5 rounded-lg border transition ${
                    role === "owner"
                      ? "border-brand-accent bg-brand-accent/10"
                      : "border-brand-gray hover:border-brand-accent/50"
                  }`}
                >
                  <div className="text-2xl mb-2">🥋</div>
                  <div className="text-white font-semibold mb-1">Academy Owner</div>
                  <div className="text-gray-500 text-xs">Run your gym, manage members, track classes and revenue.</div>
                </button>
                <button
                  type="button"
                  onClick={() => setRole("instructor")}
                  className={`text-left p-5 rounded-lg border transition ${
                    role === "instructor"
                      ? "border-brand-accent bg-brand-accent/10"
                      : "border-brand-gray hover:border-brand-accent/50"
                  }`}
                >
                  <div className="text-2xl mb-2">🥇</div>
                  <div className="text-white font-semibold mb-1">Instructor</div>
                  <div className="text-gray-500 text-xs">Teach at one or more gyms, manage classes and students.</div>
                </button>
                <button
                  type="button"
                  onClick={() => setRole("student")}
                  className={`text-left p-5 rounded-lg border transition ${
                    role === "student"
                      ? "border-brand-accent bg-brand-accent/10"
                      : "border-brand-gray hover:border-brand-accent/50"
                  }`}
                >
                  <div className="text-2xl mb-2">🎓</div>
                  <div className="text-white font-semibold mb-1">Student</div>
                  <div className="text-gray-500 text-xs">Find a gym, track your training, follow your belt journey.</div>
                </button>
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
                  disabled={!role || loading}
                  className="flex-1 bg-brand-accent text-brand-black font-bold py-3 rounded-lg hover:bg-brand-accent/90 transition disabled:opacity-50"
                >
                  {loading ? "Creating..." : "Continue"}
                </button>
              </div>
            </>
          ) : step === 1 ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">First Name</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full px-4 py-3 bg-brand-black border border-brand-gray rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-brand-accent transition"
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
                    className="w-full px-4 py-3 bg-brand-black border border-brand-gray rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-brand-accent transition"
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
                  className="w-full px-4 py-3 bg-brand-black border border-brand-gray rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-brand-accent transition"
                  placeholder="marcus@ironlion.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Phone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-3 bg-brand-black border border-brand-gray rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-brand-accent transition"
                  placeholder="(555) 123 4567"
                  autoComplete="tel"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-brand-black border border-brand-gray rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-brand-accent transition"
                  placeholder="Min 6 characters"
                  minLength={6}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-brand-accent text-brand-black font-bold py-3 rounded-lg hover:bg-brand-accent/90 transition disabled:opacity-50"
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
                  className="w-full px-4 py-3 bg-brand-black border border-brand-gray rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-brand-accent transition"
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
                    className="flex-1 px-4 py-3 bg-brand-black border border-brand-gray rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-brand-accent transition"
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
                  className="w-full px-4 py-3 bg-brand-black border border-brand-gray rounded-lg text-white focus:outline-none focus:border-brand-accent transition"
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
                  onClick={() => setStep(2)}
                  className="flex-1 border border-brand-gray text-gray-300 font-bold py-3 rounded-lg hover:bg-brand-gray/20 transition"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading || !gymName || !gymSlug}
                  className="flex-1 bg-brand-accent text-brand-black font-bold py-3 rounded-lg hover:bg-brand-accent/90 transition disabled:opacity-50"
                >
                  {loading ? "Creating..." : "Launch My Gym"}
                </button>
              </div>
            </>
          )}

          <p className="text-center text-gray-500 text-sm pt-2">
            Already have an account?{" "}
            <Link href="/sign-in" className="text-brand-accent hover:underline">
              Sign in
            </Link>
          </p>
        </form>

        <p className="text-center text-gray-600 text-xs mt-6">
          30 day free trial. No credit card required.
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
