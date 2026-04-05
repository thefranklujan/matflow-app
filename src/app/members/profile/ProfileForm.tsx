"use client";

import { useState, useEffect } from "react";
import BeltDisplay from "@/components/members/BeltDisplay";

interface MemberProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  beltRank: string;
  stripes: number;
  locationSlug: string | null;
  createdAt: string;
}

export default function ProfileForm() {
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    fetch("/api/members/profile")
      .then((res) => res.json())
      .then((data) => {
        setProfile(data);
        setFirstName(data.firstName || "");
        setLastName(data.lastName || "");
        setPhone(data.phone || "");
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/members/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, phone }),
      });

      if (res.ok) {
        const updated = await res.json();
        setProfile(updated);
        setMessage({ type: "success", text: "Profile updated successfully." });
      } else {
        const err = await res.json();
        setMessage({
          type: "error",
          text: err.error || "Failed to update profile.",
        });
      }
    } catch {
      setMessage({ type: "error", text: "An error occurred." });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-brand-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-white uppercase tracking-wider mb-8">
        My Profile
      </h1>

      {/* Belt Info */}
      {profile && (
        <div className="bg-brand-dark border border-brand-gray rounded-lg p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400 uppercase tracking-wider mb-1">
                Member since{" "}
                {new Date(profile.createdAt).toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                })}
              </p>
              <p className="text-white text-lg font-semibold capitalize">
                {profile.beltRank} Belt
                {profile.stripes > 0 &&
                  ` - ${profile.stripes} stripe${profile.stripes !== 1 ? "s" : ""}`}
              </p>
            </div>
            <BeltDisplay
              beltRank={profile.beltRank}
              stripes={profile.stripes}
              size="md"
            />
          </div>
        </div>
      )}

      {/* Edit Form */}
      <form
        onSubmit={handleSave}
        className="bg-brand-dark border border-brand-gray rounded-lg p-6 space-y-6"
      >
        <h2 className="text-lg font-semibold text-white uppercase tracking-wider">
          Edit Information
        </h2>

        {message && (
          <div
            className={`px-4 py-3 rounded-lg text-sm ${
              message.type === "success"
                ? "bg-green-500/10 text-green-400 border border-green-500/30"
                : "bg-red-500/10 text-red-400 border border-red-500/30"
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              First Name
            </label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              className="w-full bg-brand-black border border-brand-gray rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:border-brand-accent focus:outline-none transition"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Last Name
            </label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              className="w-full bg-brand-black border border-brand-gray rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:border-brand-accent focus:outline-none transition"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Email</label>
          <input
            type="email"
            value={profile?.email || ""}
            disabled
            className="w-full bg-brand-black border border-brand-gray rounded-lg px-4 py-3 text-gray-500 cursor-not-allowed"
          />
          <p className="text-xs text-gray-600 mt-1">
            Email cannot be changed.
          </p>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Phone</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(555) 123-4567"
            className="w-full bg-brand-black border border-brand-gray rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:border-brand-accent focus:outline-none transition"
          />
        </div>

        {profile?.locationSlug && (
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Home Location
            </label>
            <input
              type="text"
              value={
                profile.locationSlug === "magnolia" ? "Magnolia" : "Cypress"
              }
              disabled
              className="w-full bg-brand-black border border-brand-gray rounded-lg px-4 py-3 text-gray-500 cursor-not-allowed capitalize"
            />
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-brand-accent text-brand-black font-semibold py-3 rounded-lg hover:bg-brand-accent/90 transition disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </form>
    </div>
  );
}
