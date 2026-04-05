"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CLASS_TYPES } from "@/lib/constants";

interface VideoFormProps {
  video?: {
    id: string;
    title: string;
    embedUrl: string;
    description: string | null;
    classType: string;
    classDate: string;
    published: boolean;
  };
}

export default function VideoForm({ video }: VideoFormProps) {
  const router = useRouter();
  const isEdit = !!video;

  const [title, setTitle] = useState(video?.title || "");
  const [embedUrl, setEmbedUrl] = useState(video?.embedUrl || "");
  const [description, setDescription] = useState(video?.description || "");
  const [classType, setClassType] = useState(video?.classType || CLASS_TYPES[0].value);
  const [classDate, setClassDate] = useState(
    video?.classDate ? new Date(video.classDate).toISOString().split("T")[0] : ""
  );
  const [published, setPublished] = useState(video?.published ?? true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const payload = { title, embedUrl, description, classType, classDate, published };

    const url = isEdit ? `/api/admin/videos/${video.id}` : "/api/admin/videos";
    const method = isEdit ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      router.push("/app/videos");
      router.refresh();
    } else {
      const data = await res.json();
      setError(data.error || "Something went wrong.");
    }
    setLoading(false);
  }

  return (
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
        <label className="block text-sm text-gray-400 mb-1">Embed URL</label>
        <input
          type="url"
          value={embedUrl}
          onChange={(e) => setEmbedUrl(e.target.value)}
          required
          placeholder="https://www.youtube.com/embed/..."
          className="w-full bg-brand-gray border border-brand-gray rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-accent"
        />
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-1">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full bg-brand-gray border border-brand-gray rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-accent resize-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Class Type</label>
          <select
            value={classType}
            onChange={(e) => setClassType(e.target.value)}
            className="w-full bg-brand-gray border border-brand-gray rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-accent"
          >
            {CLASS_TYPES.map((ct) => (
              <option key={ct.value} value={ct.value}>
                {ct.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Class Date</label>
          <input
            type="date"
            value={classDate}
            onChange={(e) => setClassDate(e.target.value)}
            required
            className="w-full bg-brand-gray border border-brand-gray rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-accent"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="published"
          checked={published}
          onChange={(e) => setPublished(e.target.checked)}
          className="rounded border-brand-gray bg-brand-gray text-brand-accent focus:ring-brand-accent"
        />
        <label htmlFor="published" className="text-sm text-gray-300">
          Published
        </label>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={loading}
          className="bg-brand-accent text-brand-black font-bold px-4 py-2 rounded-lg hover:bg-brand-accent/90 transition text-sm disabled:opacity-50"
        >
          {loading ? "Saving..." : isEdit ? "Update Video" : "Create Video"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/app/videos")}
          className="text-sm text-gray-400 hover:text-white transition"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
