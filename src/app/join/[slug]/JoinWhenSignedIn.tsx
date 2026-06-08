"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function JoinWhenSignedIn({
  gymSlug,
  gymName,
}: {
  gymSlug: string;
  gymName: string;
}) {
  const router = useRouter();
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");

  async function join() {
    setJoining(true);
    setError("");
    const res = await fetch("/api/auth/join-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gymSlug }),
    });
    if (res.ok) {
      router.push("/student");
      router.refresh();
    } else {
      setJoining(false);
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Could not join gym");
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-gray-400 text-sm">You&apos;re signed in. Join with one tap.</p>
      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}
      <button
        onClick={join}
        disabled={joining}
        className="block w-full bg-brand-accent text-brand-black font-bold py-3 rounded-lg hover:bg-brand-accent/90 transition text-center uppercase tracking-wider disabled:opacity-50"
      >
        {joining ? "Joining..." : `Join ${gymName}`}
      </button>
    </div>
  );
}
