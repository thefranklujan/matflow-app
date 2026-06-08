"use client";

import { useState } from "react";

interface Waiver {
  id: string;
  title: string;
  content: string;
  version: number;
}

const inputClass =
  "w-full px-4 py-2 bg-brand-black border border-brand-gray rounded-lg text-white focus:border-brand-accent focus:outline-none transition";

export default function DropInForm({ gymSlug, waiver }: { gymSlug: string; waiver: Waiver | null }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [classType, setClassType] = useState("");
  const [agree, setAgree] = useState(false);
  const [signedName, setSignedName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (waiver && (!agree || !signedName.trim())) {
      setError("Please read and sign the waiver to continue.");
      return;
    }
    setSubmitting(true);
    const res = await fetch(`/api/dropin/${gymSlug}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName,
        lastName,
        email,
        phone,
        emergencyName,
        emergencyPhone,
        classType,
        agree,
        signedName,
      }),
    });
    setSubmitting(false);
    if (res.ok) {
      setDone(true);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Something went wrong. Please try again.");
    }
  }

  if (done) {
    return (
      <div className="bg-brand-dark border border-brand-accent/30 rounded-lg p-8 text-center">
        <h2 className="text-xl font-bold text-white mb-2">You&apos;re checked in 🥋</h2>
        <p className="text-gray-400 text-sm">
          Thanks, {firstName}. {waiver ? "Your waiver is signed. " : ""}Enjoy your class!
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-brand-dark border border-brand-gray rounded-lg p-6 space-y-4">
      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm text-gray-300 mb-1">First name *</label>
          <input className={inputClass} value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm text-gray-300 mb-1">Last name *</label>
          <input className={inputClass} value={lastName} onChange={(e) => setLastName(e.target.value)} required />
        </div>
      </div>

      <div>
        <label className="block text-sm text-gray-300 mb-1">Email</label>
        <input type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <label className="block text-sm text-gray-300 mb-1">Phone</label>
        <input type="tel" className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm text-gray-300 mb-1">Emergency contact</label>
          <input className={inputClass} value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} placeholder="Name" />
        </div>
        <div>
          <label className="block text-sm text-gray-300 mb-1">Emergency phone</label>
          <input type="tel" className={inputClass} value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} placeholder="Phone" />
        </div>
      </div>

      <div>
        <label className="block text-sm text-gray-300 mb-1">Class (optional)</label>
        <input className={inputClass} value={classType} onChange={(e) => setClassType(e.target.value)} placeholder="e.g. Gi, No-Gi, Open Mat" />
      </div>

      {waiver && (
        <div className="space-y-3 pt-2 border-t border-brand-gray/50">
          <p className="text-sm font-semibold text-white">{waiver.title}</p>
          <div className="max-h-48 overflow-y-auto bg-brand-black border border-brand-gray rounded-lg p-3 text-xs text-gray-400 whitespace-pre-line">
            {waiver.content}
          </div>
          <label className="flex items-start gap-2 text-sm text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={agree}
              onChange={(e) => setAgree(e.target.checked)}
              className="mt-1 rounded border-brand-gray"
            />
            I have read and agree to the waiver above.
          </label>
          <div>
            <label className="block text-sm text-gray-300 mb-1">Type your full name to sign *</label>
            <input className={inputClass} value={signedName} onChange={(e) => setSignedName(e.target.value)} placeholder="Your full legal name" />
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-brand-accent text-brand-black font-bold py-3 rounded-lg hover:bg-brand-accent/90 transition disabled:opacity-50 uppercase tracking-wider"
      >
        {submitting ? "Checking in..." : "Check in"}
      </button>
    </form>
  );
}
