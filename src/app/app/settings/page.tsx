"use client";

import { useState, useEffect } from "react";
import NotificationSettings from "@/components/NotificationSettings";
import DeleteAccountSection from "@/components/DeleteAccountSection";

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

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((d) => { setSettings(d.data); setLoading(false); })
      .catch(() => setLoading(false));
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

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !settings) return;
    setMessage("Uploading logo...");
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    if (!res.ok) {
      setMessage("Logo upload failed");
      return;
    }
    const { url } = await res.json();
    const next = { ...settings, logo: url };
    setSettings(next);
    // persist immediately
    await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    setMessage("Logo updated!");
  }

  async function viewAsStudent() {
    const res = await fetch("/api/admin/view-as-student", { method: "POST" });
    if (res.ok) window.location.href = "/app";
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Gym Settings</h1>
        <button
          type="button"
          onClick={viewAsStudent}
          className="bg-yellow-500 text-black font-bold px-4 py-2 rounded-lg hover:bg-yellow-400 transition text-sm"
        >
          👀 View as Student
        </button>
      </div>

      <div className="bg-brand-dark border border-brand-gray rounded-lg p-6 mb-6">
        <label className="block text-sm font-medium text-gray-300 mb-3">Gym Logo</label>
        <div className="flex items-center gap-4">
          <div className="h-20 w-20 rounded-lg bg-brand-black border border-brand-gray flex items-center justify-center overflow-hidden">
            {settings.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={settings.logo} alt="Gym logo" className="h-full w-full object-cover" />
            ) : (
              <span className="text-gray-600 text-xs">No logo</span>
            )}
          </div>
          <div className="flex-1">
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleLogoUpload}
              className="block text-sm text-gray-400 file:mr-3 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-brand-accent file:text-brand-black hover:file:bg-brand-accent/90"
            />
            <p className="text-gray-600 text-xs mt-1">PNG, JPG, or WebP. Max 5MB.</p>
          </div>
        </div>
      </div>

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

      <div className="mt-10">
        <h2 className="text-xl font-bold text-white mb-4">Notifications</h2>
        <NotificationSettings />
      </div>

      <div className="mt-10">
        <h2 className="text-xl font-bold text-white mb-4">Danger zone</h2>
        <DeleteAccountSection />
      </div>
    </div>
  );
}
