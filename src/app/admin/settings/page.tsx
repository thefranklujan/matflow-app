"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface GymSettings {
  name: string;
  slug: string;
  logo: string | null;
  primaryColor: string;
  secondaryColor: string | null;
  phone: string | null;
  website: string | null;
  timezone: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<GymSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((d) => { setSettings(d.data); setLoading(false); })
      .catch(() => setLoading(false));
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((d) => { if (d.isPlatformAdmin) setIsPlatformAdmin(true); })
      .catch(() => {});
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setMessage("");

    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        setMessage("Settings saved!");
      } else {
        setMessage("Failed to save settings");
      }
    } catch {
      setMessage("Error saving settings");
    }
    setSaving(false);
  }

  if (loading) {
    return <div className="p-8 text-gray-400">Loading settings...</div>;
  }

  if (!settings) {
    return <div className="p-8 text-red-400">Failed to load settings</div>;
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-white mb-6">Gym Settings</h1>

      <form onSubmit={handleSave} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Gym Name</label>
          <input
            type="text"
            value={settings.name}
            onChange={(e) => setSettings({ ...settings, name: e.target.value })}
            className="w-full px-4 py-3 bg-brand-black border border-brand-gray rounded-lg text-white focus:outline-none focus:border-brand-accent transition"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">URL Slug</label>
          <p className="text-gray-500 text-sm mb-1">mymatflow.com/join/{settings.slug}</p>
          <p className="text-gray-600 text-xs">Slug cannot be changed after creation.</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Primary Color</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={settings.primaryColor}
                onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
                className="w-10 h-10 rounded cursor-pointer bg-transparent border-0"
              />
              <input
                type="text"
                value={settings.primaryColor}
                onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
                className="flex-1 px-3 py-2 bg-brand-black border border-brand-gray rounded text-white text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Secondary Color</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={settings.secondaryColor || "#1a1a1a"}
                onChange={(e) => setSettings({ ...settings, secondaryColor: e.target.value })}
                className="w-10 h-10 rounded cursor-pointer bg-transparent border-0"
              />
              <input
                type="text"
                value={settings.secondaryColor || ""}
                onChange={(e) => setSettings({ ...settings, secondaryColor: e.target.value || null })}
                className="flex-1 px-3 py-2 bg-brand-black border border-brand-gray rounded text-white text-sm"
                placeholder="Optional"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Phone</label>
          <input
            type="tel"
            value={settings.phone || ""}
            onChange={(e) => setSettings({ ...settings, phone: e.target.value || null })}
            className="w-full px-4 py-3 bg-brand-black border border-brand-gray rounded-lg text-white focus:outline-none focus:border-brand-accent transition"
            placeholder="Optional"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Website</label>
          <input
            type="url"
            value={settings.website || ""}
            onChange={(e) => setSettings({ ...settings, website: e.target.value || null })}
            className="w-full px-4 py-3 bg-brand-black border border-brand-gray rounded-lg text-white focus:outline-none focus:border-brand-accent transition"
            placeholder="https://yourgym.com"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Timezone</label>
          <select
            value={settings.timezone}
            onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
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

        {message && (
          <p className={`text-sm ${message.includes("saved") ? "text-brand-accent" : "text-red-400"}`}>
            {message}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="bg-brand-accent text-brand-black font-bold px-6 py-3 rounded-lg hover:bg-brand-accent/90 transition disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </form>

      {isPlatformAdmin && (
        <div className="mt-10 pt-6 border-t border-white/10">
          <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">Platform</h2>
          <Link
            href="/platform"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-orange-500/10 border border-orange-500/20 rounded-lg text-orange-400 hover:bg-orange-500/20 transition text-sm font-medium"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>
            Platform Dashboard
          </Link>
        </div>
      )}
    </div>
  );
}
