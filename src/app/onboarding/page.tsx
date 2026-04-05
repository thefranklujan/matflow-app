"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MATFLOW } from "@/lib/constants";

export default function OnboardingPage() {
  const router = useRouter();
  const [gymName, setGymName] = useState("");
  const [slug, setSlug] = useState("");
  const [timezone, setTimezone] = useState("America/Chicago");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleNameChange(value: string) {
    setGymName(value);
    // Auto-generate slug from name
    setSlug(
      value
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/--+/g, "-")
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gymName, slug, timezone }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create gym");
        setLoading(false);
        return;
      }

      router.push("/admin");
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-black px-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Welcome to {MATFLOW.name}</h1>
          <p className="text-gray-400">Set up your gym to get started</p>
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
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Gym Name
            </label>
            <input
              type="text"
              value={gymName}
              onChange={(e) => handleNameChange(e.target.value)}
              className="w-full px-4 py-3 bg-brand-black border border-brand-gray rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-brand-accent transition"
              placeholder="e.g. Ceconi BJJ"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              URL Slug
            </label>
            <div className="flex items-center gap-2">
              <span className="text-gray-500 text-sm">mymatflow.com/join/</span>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                className="flex-1 px-4 py-3 bg-brand-black border border-brand-gray rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-brand-accent transition"
                placeholder="ceconi-bjj"
                required
              />
            </div>
            <p className="text-gray-600 text-xs mt-1">
              This is how members will find your gym. Use lowercase letters, numbers, and hyphens.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Timezone
            </label>
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

          <button
            type="submit"
            disabled={loading || !gymName || !slug}
            className="w-full bg-brand-accent text-brand-black font-bold py-3 rounded-lg hover:bg-brand-accent/90 transition disabled:opacity-50"
          >
            {loading ? "Creating your gym..." : "Create Gym"}
          </button>
        </form>
      </div>
    </div>
  );
}
