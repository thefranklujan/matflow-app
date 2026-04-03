"use client";

import { useState, useEffect } from "react";

interface WaiverData {
  template: { id: string; title: string; content: string } | null;
  signed: boolean;
  signedAt: string | null;
}

export default function MemberWaiverPage() {
  const [data, setData] = useState<WaiverData | null>(null);
  const [signedName, setSignedName] = useState("");
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    fetch("/api/members/waiver").then((r) => r.json()).then(setData);
  }, []);

  async function handleSign(e: React.FormEvent) {
    e.preventDefault();
    if (!data?.template || !signedName || !agreed) return;
    setLoading(true);

    const res = await fetch("/api/members/waiver", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId: data.template.id, signedName }),
    });

    if (res.ok) {
      const result = await res.json();
      setData({ ...data, signed: true, signedAt: result.signedAt });
    }
    setLoading(false);
  }

  if (!data) return <div className="text-gray-500 p-8">Loading...</div>;

  if (!data.template) {
    return (
      <div className="max-w-2xl mx-auto p-8">
        <h1 className="text-2xl font-bold text-white mb-4">Waiver</h1>
        <p className="text-gray-400">No waiver is currently required by your gym.</p>
      </div>
    );
  }

  if (data.signed) {
    return (
      <div className="max-w-2xl mx-auto p-8">
        <h1 className="text-2xl font-bold text-white mb-4">{data.template.title}</h1>
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-6 text-center">
          <p className="text-green-400 text-lg font-medium mb-1">Waiver Signed</p>
          <p className="text-gray-400 text-sm">
            Signed on {new Date(data.signedAt!).toLocaleDateString()}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-bold text-white mb-2">{data.template.title}</h1>
      <p className="text-gray-400 text-sm mb-6">Please read and sign the waiver below to continue.</p>

      <div className="bg-brand-dark border border-brand-gray rounded-lg p-6 mb-6 max-h-80 overflow-y-auto">
        <p className="text-gray-300 text-sm whitespace-pre-line">{data.template.content}</p>
      </div>

      <form onSubmit={handleSign} className="space-y-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-1 accent-brand-teal"
          />
          <span className="text-gray-300 text-sm">
            I have read and agree to the terms of this waiver
          </span>
        </label>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Type your full name to sign</label>
          <input
            type="text"
            value={signedName}
            onChange={(e) => setSignedName(e.target.value)}
            className="w-full px-4 py-3 bg-brand-black border border-brand-gray rounded-lg text-white italic text-lg"
            placeholder="Your Full Name"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading || !agreed || !signedName}
          className="w-full bg-brand-teal text-brand-black font-bold py-3 rounded-lg disabled:opacity-50"
        >
          {loading ? "Signing..." : "Sign Waiver"}
        </button>
      </form>
    </div>
  );
}
