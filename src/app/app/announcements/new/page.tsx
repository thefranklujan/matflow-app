"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import Link from "next/link";
import { BELT_RANKS } from "@/lib/constants";

export default function AdminNewAnnouncementPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [pinned, setPinned] = useState(false);
  const [emailChannel, setEmailChannel] = useState(false);
  const [audience, setAudience] = useState("all");
  const [emailTest, setEmailTest] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/admin/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        content,
        pinned,
        channels: { email: emailChannel },
        audience,
        emailTest,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (emailChannel && data.email) {
        // Stay on the page and report delivery so the owner sees what happened.
        const { sent, failed, skipped } = data.email;
        const parts = ["Posted in-app & push."];
        if (sent > 0) parts.push(`Emailed ${sent}.`);
        if (failed > 0) parts.push(`${failed} failed.`);
        if (skipped > 0) parts.push(`${skipped} not emailed (provider off or unsubscribed).`);
        if (sent === 0 && failed === 0) parts.push("No emails dispatched — email sending isn't configured in this environment.");
        setResult(parts.join(" "));
        setLoading(false);
        return;
      }
      router.push("/app/announcements");
      router.refresh();
    } else {
      const data = await res.json();
      setError(data.error || "Something went wrong.");
    }
    setLoading(false);
  }

  return (
      <div>
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/app/announcements"
            className="text-gray-400 hover:text-white transition text-sm"
          >
            &larr; Back to Announcements
          </Link>
        </div>
        <h1 className="text-2xl font-bold text-white mb-6">New Announcement</h1>

        <form onSubmit={handleSubmit} className="max-w-2xl space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full bg-brand-gray border border-brand-gray rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-accent"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Content</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
              rows={6}
              className="w-full bg-brand-gray border border-brand-gray rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-accent resize-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="pinned"
              checked={pinned}
              onChange={(e) => setPinned(e.target.checked)}
              className="rounded border-brand-gray bg-brand-gray text-brand-accent focus:ring-brand-accent"
            />
            <label htmlFor="pinned" className="text-sm text-gray-300">
              Pin this announcement
            </label>
          </div>

          {/* Delivery channels */}
          <div className="bg-brand-dark border border-brand-gray rounded-lg p-4 space-y-3">
            <p className="text-sm font-medium text-gray-300">Delivery</p>
            <label className="flex items-center gap-2 text-sm text-gray-400">
              <input type="checkbox" checked disabled className="rounded border-brand-gray" />
              In-app &amp; push notification <span className="text-gray-600">(always on)</span>
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={emailChannel}
                onChange={(e) => setEmailChannel(e.target.checked)}
                className="rounded border-brand-gray bg-brand-gray text-brand-accent focus:ring-brand-accent"
              />
              Also send by email
            </label>

            {emailChannel && (
              <div className="pl-6 space-y-3 border-l border-brand-gray/50">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Audience</label>
                  <select
                    value={audience}
                    onChange={(e) => setAudience(e.target.value)}
                    className="w-full bg-brand-gray border border-brand-gray rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-accent"
                  >
                    <option value="all">All members</option>
                    {BELT_RANKS.map((b) => (
                      <option key={b.value} value={b.value}>{b.label} belts</option>
                    ))}
                  </select>
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={emailTest}
                    onChange={(e) => setEmailTest(e.target.checked)}
                    className="rounded border-brand-gray bg-brand-gray text-brand-accent focus:ring-brand-accent"
                  />
                  Send a test to myself only
                </label>
                <p className="text-xs text-gray-500">
                  Members who unsubscribed from email are skipped automatically.
                </p>
              </div>
            )}
          </div>

          {result && (
            <div className="bg-green-500/10 border border-green-500/40 text-green-300 px-4 py-3 rounded-lg text-sm">
              {result}{" "}
              <Link href="/app/announcements" className="underline">View announcements</Link>
            </div>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={loading}
              className="bg-brand-accent text-brand-black font-bold px-4 py-2 rounded-lg hover:bg-brand-accent/90 transition text-sm disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create Announcement"}
            </button>
            <button
              type="button"
              onClick={() => router.push("/app/announcements")}
              className="text-sm text-gray-400 hover:text-white transition"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
  );
}
