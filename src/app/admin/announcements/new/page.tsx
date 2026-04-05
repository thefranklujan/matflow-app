"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import Link from "next/link";

export default function AdminNewAnnouncementPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [pinned, setPinned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/admin/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content, pinned }),
    });

    if (res.ok) {
      router.push("/admin/announcements");
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
            href="/admin/announcements"
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
              onClick={() => router.push("/admin/announcements")}
              className="text-sm text-gray-400 hover:text-white transition"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
  );
}
