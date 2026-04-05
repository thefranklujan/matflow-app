"use client";

import { useState, useEffect, use } from "react";

interface ClassInfo {
  id: string;
  classType: string;
  startTime: string;
  endTime: string;
  instructor: string;
  topic: string | null;
}

export default function KioskPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [gymName, setGymName] = useState("");
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [email, setEmail] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [memberInfo, setMemberInfo] = useState<{ name: string; belt: string; stripes: number } | null>(null);

  useEffect(() => {
    fetch(`/api/kiosk/${slug}`)
      .then((r) => r.json())
      .then((data) => {
        setGymName(data.gym?.name || "");
        setClasses(data.classes || []);
        if (data.classes?.length === 1) setSelectedClass(data.classes[0].classType);
      });
  }, [slug]);

  async function handleCheckIn(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !selectedClass) return;

    setStatus("loading");
    try {
      const res = await fetch(`/api/kiosk/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, classType: selectedClass }),
      });
      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setMessage(data.error || "Check-in failed");
        return;
      }

      setStatus("success");
      setMemberInfo(data.member);
      setMessage(data.alreadyCheckedIn ? "Already checked in!" : "Checked in!");

      // Auto-reset after 5 seconds
      setTimeout(() => {
        setStatus("idle");
        setEmail("");
        setMemberInfo(null);
        setMessage("");
      }, 5000);
    } catch {
      setStatus("error");
      setMessage("Something went wrong. Try again.");
    }
  }

  function formatTime(t: string) {
    const [h, m] = t.split(":");
    const hour = parseInt(h);
    const ampm = hour >= 12 ? "PM" : "AM";
    const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${h12}:${m} ${ampm}`;
  }

  if (status === "success" && memberInfo) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center">
        <div className="text-6xl mb-6">&#10003;</div>
        <h1 className="text-4xl font-bold text-white mb-2">{message}</h1>
        <p className="text-2xl text-brand-accent mb-2">{memberInfo.name}</p>
        <p className="text-xl text-gray-400 capitalize">{memberInfo.belt} Belt{memberInfo.stripes > 0 ? ` | ${memberInfo.stripes} stripe${memberInfo.stripes > 1 ? "s" : ""}` : ""}</p>
        <p className="text-gray-600 mt-8 text-sm">Screen will reset in 5 seconds...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-lg">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-white mb-2">{gymName || "Loading..."}</h1>
          <p className="text-xl text-gray-400">Class Check-In</p>
        </div>

        {status === "error" && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-6 py-4 rounded-lg text-center text-lg mb-6">
            {message}
          </div>
        )}

        {classes.length === 0 ? (
          <div className="text-center text-gray-500 text-xl">No classes scheduled today.</div>
        ) : (
          <form onSubmit={handleCheckIn} className="space-y-6">
            <div>
              <label className="block text-lg font-medium text-gray-300 mb-3">Select Class</label>
              <div className="grid gap-3">
                {classes.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedClass(c.classType)}
                    className={`w-full text-left px-6 py-4 rounded-xl border-2 transition text-lg ${
                      selectedClass === c.classType
                        ? "border-brand-accent bg-brand-accent/10 text-white"
                        : "border-brand-gray bg-brand-dark text-gray-300 hover:border-gray-500"
                    }`}
                  >
                    <div className="font-bold">{c.classType}</div>
                    <div className="text-sm text-gray-400">
                      {formatTime(c.startTime)} to {formatTime(c.endTime)} | {c.instructor}
                      {c.topic && ` | ${c.topic}`}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-lg font-medium text-gray-300 mb-3">Your Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setStatus("idle"); }}
                className="w-full px-6 py-4 bg-brand-dark border-2 border-brand-gray rounded-xl text-white text-xl placeholder-gray-500 focus:outline-none focus:border-brand-accent"
                placeholder="you@email.com"
                required
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={status === "loading" || !selectedClass || !email}
              className="w-full bg-brand-accent text-brand-black font-bold py-5 rounded-xl text-2xl uppercase tracking-wider disabled:opacity-50 transition hover:bg-brand-accent/90"
            >
              {status === "loading" ? "Checking In..." : "Check In"}
            </button>
          </form>
        )}

        <p className="text-center text-gray-600 text-sm mt-10">Powered by MatFlow</p>
      </div>
    </div>
  );
}
