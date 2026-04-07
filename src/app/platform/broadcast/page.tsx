"use client";

import { useState } from "react";

export default function BroadcastPage() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [pinned, setPinned] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!confirm(`Send this announcement to ALL gyms? This cannot be undone.`)) return;
    setLoading(true);
    setResult(null);

    const res = await fetch("/api/platform/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content, pinned }),
    });

    const data = await res.json();
    if (res.ok) {
      setResult(`Sent to ${data.gymCount} gyms`);
      setTitle("");
      setContent("");
    } else {
      setResult(`Error: ${data.error}`);
    }
    setLoading(false);
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-bold text-white mb-2">Broadcast Announcement</h1>
      <p className="text-gray-500 mb-8">Send a message to every gym on the platform. It will appear on their dashboards as a pinned announcement.</p>

      <form onSubmit={handleSubmit} className="bg-[#111] border border-white/10 rounded-lg p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="New feature announcement"
            className="w-full px-4 py-3 bg-black border border-white/10 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-orange-500"
            required
          />
          <p className="text-gray-600 text-xs mt-1">Will be prefixed with [MatFlow] when shown to gym admins</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Message</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={8}
            placeholder="Hi! We just shipped a new feature that lets you..."
            className="w-full px-4 py-3 bg-black border border-white/10 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-orange-500"
            required
          />
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={pinned}
            onChange={(e) => setPinned(e.target.checked)}
            className="accent-orange-500"
          />
          <span className="text-gray-300 text-sm">Pin to top of dashboard</span>
        </label>

        {result && (
          <div className={`px-4 py-3 rounded-lg text-sm ${result.startsWith("Error") ? "bg-red-500/10 text-red-400 border border-red-500/30" : "bg-green-500/10 text-green-400 border border-green-500/30"}`}>
            {result}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !title || !content}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-lg transition disabled:opacity-50"
        >
          {loading ? "Broadcasting..." : "Send to All Gyms"}
        </button>
      </form>
    </div>
  );
}
