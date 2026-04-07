"use client";

import { useState } from "react";

export default function NominateForm() {
  const [gymName, setGymName] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    const res = await fetch("/api/student/nominate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gymName, city, state, ownerEmail, ownerPhone, notes }),
    });
    if (res.ok) {
      setMessage("Thanks! We'll take it from here.");
      setGymName(""); setCity(""); setState(""); setOwnerEmail(""); setOwnerPhone(""); setNotes("");
      setTimeout(() => window.location.reload(), 800);
    } else {
      setMessage("Something went wrong. Try again.");
    }
    setSaving(false);
  }

  return (
    <form onSubmit={submit} className="bg-[#0a0a0a] border border-white/10 rounded-xl p-5 space-y-4">
      <div>
        <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1">Gym Name *</label>
        <input value={gymName} onChange={(e) => setGymName(e.target.value)} required placeholder="Iron Lion Academy" className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1">City</label>
          <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Austin" className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1">State</label>
          <input value={state} onChange={(e) => setState(e.target.value)} placeholder="TX" className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />
        </div>
      </div>
      <div>
        <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1">Owner Email (optional)</label>
        <input type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} placeholder="owner@gym.com" className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />
      </div>
      <div>
        <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1">Owner Phone (optional)</label>
        <input value={ownerPhone} onChange={(e) => setOwnerPhone(e.target.value)} placeholder="555-0100" className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />
      </div>
      <div>
        <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1">Notes</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="How many students? Belt rank? Best way to reach the owner?" className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />
      </div>
      <button type="submit" disabled={saving} className="bg-[#dc2626] hover:bg-[#b91c1c] text-white font-bold px-5 py-2.5 rounded-lg transition text-sm disabled:opacity-50">
        {saving ? "Submitting..." : "Nominate Gym"}
      </button>
      {message && <p className="text-sm text-gray-400">{message}</p>}
    </form>
  );
}
