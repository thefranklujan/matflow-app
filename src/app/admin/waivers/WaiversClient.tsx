"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Signature {
  id: string;
  signedName: string;
  signedAt: string;
  member: { firstName: string; lastName: string; email: string };
}

interface Template {
  id: string;
  title: string;
  content: string;
  active: boolean;
  version: number;
  createdAt: string;
  signatures: Signature[];
}

export default function WaiversClient({ templates, totalMembers }: { templates: Template[]; totalMembers: number }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("Liability Waiver & Release of Claims");
  const [content, setContent] = useState(
    `I, the undersigned, hereby acknowledge that martial arts training involves inherent risks including but not limited to physical injury. I voluntarily assume all risks associated with participation in classes, open mats, and events at this academy.\n\nI release and hold harmless the academy, its instructors, staff, and affiliates from any claims, damages, or liabilities arising from my participation.\n\nI confirm that I am in good health and have no medical conditions that would prevent safe participation. I agree to follow all safety rules and instructor guidance.\n\nI understand this waiver remains in effect for the duration of my membership.`
  );
  const [loading, setLoading] = useState(false);

  const activeTemplate = templates.find((t) => t.active);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/admin/waivers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content }),
    });
    setLoading(false);
    setShowForm(false);
    router.refresh();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Waivers</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-brand-teal text-brand-black font-bold px-4 py-2 rounded-lg text-sm"
        >
          {showForm ? "Cancel" : "+ New Waiver"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-brand-dark border border-brand-gray rounded-lg p-6 mb-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 bg-brand-black border border-brand-gray rounded-lg text-white"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Waiver Content</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={10}
              className="w-full px-4 py-2 bg-brand-black border border-brand-gray rounded-lg text-white text-sm"
              required
            />
          </div>
          <button type="submit" disabled={loading} className="bg-brand-teal text-brand-black font-bold px-6 py-2 rounded-lg disabled:opacity-50">
            {loading ? "Creating..." : "Create Waiver"}
          </button>
          <p className="text-gray-500 text-xs">Creating a new waiver will deactivate any existing active waiver.</p>
        </form>
      )}

      {activeTemplate && (
        <div className="bg-brand-dark border border-brand-teal/30 rounded-lg p-6 mb-6">
          <div className="flex items-center gap-3 mb-3">
            <span className="bg-green-500/20 text-green-400 px-2 py-0.5 rounded text-xs font-medium">Active</span>
            <h2 className="text-white font-semibold">{activeTemplate.title}</h2>
          </div>
          <p className="text-gray-400 text-sm mb-4 whitespace-pre-line line-clamp-3">{activeTemplate.content}</p>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-brand-teal font-medium">{activeTemplate.signatures.length} / {totalMembers} signed</span>
            <span className="text-gray-600">Version {activeTemplate.version}</span>
          </div>

          {activeTemplate.signatures.length > 0 && (
            <div className="mt-4 border-t border-brand-gray pt-4">
              <h3 className="text-gray-400 text-xs uppercase tracking-wider mb-2">Recent Signatures</h3>
              <div className="space-y-1">
                {activeTemplate.signatures.slice(0, 10).map((sig) => (
                  <div key={sig.id} className="flex items-center justify-between text-sm">
                    <span className="text-white">{sig.member.firstName} {sig.member.lastName}</span>
                    <span className="text-gray-500">{new Date(sig.signedAt).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {templates.filter((t) => !t.active).length > 0 && (
        <div>
          <h3 className="text-gray-400 text-xs uppercase tracking-wider mb-2">Previous Waivers</h3>
          {templates.filter((t) => !t.active).map((t) => (
            <div key={t.id} className="bg-brand-dark border border-brand-gray rounded-lg p-4 mb-2">
              <div className="flex items-center justify-between">
                <span className="text-gray-300">{t.title} (v{t.version})</span>
                <span className="text-gray-500 text-sm">{t.signatures.length} signatures</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
