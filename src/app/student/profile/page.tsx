"use client";

import { useState, useEffect } from "react";

interface StudentProfile {
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  homeGym: string | null;
  beltRank: string;
  stripes: number;
  trainingSince: string | null;
}

const BELTS = [
  { value: "white", label: "White" },
  { value: "blue", label: "Blue" },
  { value: "purple", label: "Purple" },
  { value: "brown", label: "Brown" },
  { value: "black", label: "Black" },
];

export default function StudentProfilePage() {
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/student/profile").then((r) => r.json()).then((d) => {
      if (d.profile) setProfile(d.profile);
    });
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    setMessage("");
    const res = await fetch("/api/student/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });
    setMessage(res.ok ? "Saved" : "Error saving");
    setSaving(false);
  }

  if (!profile) return <p className="text-gray-500">Loading...</p>;

  return (
    <div className="max-w-lg">
      <h1 className="text-3xl font-bold text-white mb-2">Profile</h1>
      <p className="text-gray-500 mb-8">Manage your personal info.</p>

      <form onSubmit={save} className="bg-[#0a0a0a] border border-white/10 rounded-xl p-6 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-gray-400 mb-1">First Name</label>
            <input
              type="text"
              value={profile.firstName}
              onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
              className="w-full px-4 py-2 bg-black border border-white/10 rounded-lg text-white"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Last Name</label>
            <input
              type="text"
              value={profile.lastName}
              onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
              className="w-full px-4 py-2 bg-black border border-white/10 rounded-lg text-white"
              required
            />
          </div>
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Email</label>
          <input
            type="email"
            value={profile.email}
            disabled
            className="w-full px-4 py-2 bg-black border border-white/10 rounded-lg text-gray-500 cursor-not-allowed"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Phone</label>
          <input
            type="tel"
            value={profile.phone || ""}
            onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
            className="w-full px-4 py-2 bg-black border border-white/10 rounded-lg text-white"
          />
        </div>
        <div className="pt-4 mt-4 border-t border-white/5">
          <h2 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-3">Jiu-Jitsu</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Home Gym</label>
              <input
                type="text"
                value={profile.homeGym || ""}
                onChange={(e) => setProfile({ ...profile, homeGym: e.target.value })}
                placeholder="Iron Lion Academy"
                className="w-full px-4 py-2 bg-black border border-white/10 rounded-lg text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Belt</label>
                <select
                  value={profile.beltRank}
                  onChange={(e) => setProfile({ ...profile, beltRank: e.target.value })}
                  className="w-full px-4 py-2 bg-black border border-white/10 rounded-lg text-white"
                >
                  {BELTS.map((b) => (
                    <option key={b.value} value={b.value}>{b.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Stripes</label>
                <select
                  value={profile.stripes}
                  onChange={(e) => setProfile({ ...profile, stripes: Number(e.target.value) })}
                  className="w-full px-4 py-2 bg-black border border-white/10 rounded-lg text-white"
                >
                  {[0, 1, 2, 3, 4].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Training Since</label>
              <input
                type="date"
                value={profile.trainingSince || ""}
                onChange={(e) => setProfile({ ...profile, trainingSince: e.target.value || null })}
                className="w-full px-4 py-2 bg-black border border-white/10 rounded-lg text-white"
              />
            </div>
          </div>
        </div>
        {message && <p className={`text-sm ${message === "Saved" ? "text-green-400" : "text-red-400"}`}>{message}</p>}
        <button type="submit" disabled={saving} className="bg-[#dc2626] hover:bg-[#b91c1c] text-white font-bold px-6 py-2 rounded-lg disabled:opacity-50">
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </form>
    </div>
  );
}
