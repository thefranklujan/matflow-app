"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

import Link from "next/link";

const eventTypes = ["seminar", "open-mat", "promotion", "closure", "social", "other"];
const locations = ["magnolia", "cypress"];

function toLocalDatetimeValue(isoString: string | null): string {
  if (!isoString) return "";
  const d = new Date(isoString);
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

export default function AdminEditEventPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [eventType, setEventType] = useState("seminar");
  const [locationSlug, setLocationSlug] = useState("magnolia");
  const [active, setActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchEvent() {
      const res = await fetch(`/api/admin/events/${id}`);
      if (res.ok) {
        const data = await res.json();
        setTitle(data.title);
        setDescription(data.description || "");
        setDate(toLocalDatetimeValue(data.date));
        setEndDate(toLocalDatetimeValue(data.endDate));
        setEventType(data.eventType);
        setLocationSlug(data.locationSlug);
        setActive(data.active);
      } else {
        setError("Event not found.");
      }
      setFetching(false);
    }
    fetchEvent();
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch(`/api/admin/events/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description: description || null,
        date,
        endDate: endDate || null,
        eventType,
        locationSlug,
        active,
      }),
    });

    if (res.ok) {
      router.push("/app/events");
      router.refresh();
    } else {
      const data = await res.json();
      setError(data.error || "Something went wrong.");
    }
    setLoading(false);
  }

  if (fetching) {
    return (
        <div className="text-gray-400">Loading event...</div>
    );
  }

  return (
      <div>
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/app/events"
            className="text-gray-400 hover:text-white transition text-sm"
          >
            &larr; Back to Events
          </Link>
        </div>
        <h1 className="text-2xl font-bold text-white mb-6">Edit Event</h1>

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
            <label className="block text-sm text-gray-400 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full bg-brand-gray border border-brand-gray rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-accent resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Date &amp; Time</label>
              <input
                type="datetime-local"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full bg-brand-gray border border-brand-gray rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-accent"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">End Date &amp; Time (optional)</label>
              <input
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-brand-gray border border-brand-gray rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-accent"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Event Type</label>
              <select
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                className="w-full bg-brand-gray border border-brand-gray rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-accent"
              >
                {eventTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Location</label>
              <select
                value={locationSlug}
                onChange={(e) => setLocationSlug(e.target.value)}
                className="w-full bg-brand-gray border border-brand-gray rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-accent"
              >
                {locations.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="active"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="rounded border-brand-gray bg-brand-gray text-brand-accent focus:ring-brand-accent"
            />
            <label htmlFor="active" className="text-sm text-gray-300">
              Active
            </label>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={loading}
              className="bg-brand-accent text-brand-black font-bold px-4 py-2 rounded-lg hover:bg-brand-accent/90 transition text-sm disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save Changes"}
            </button>
            <button
              type="button"
              onClick={() => router.push("/app/events")}
              className="text-sm text-gray-400 hover:text-white transition"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
  );
}
