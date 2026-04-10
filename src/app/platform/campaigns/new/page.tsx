"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const STARTER_HTML = `<!-- Paste HTML Claude generates for you, or write your own -->
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px;background:#111;color:#fff;border-radius:12px;">
  <h1 style="color:#fff;">Hello from MatFlow</h1>
  <p style="color:#a3a3a3;">Replace this with your message.</p>
</div>`;

export default function NewCampaignPage() {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [audience, setAudience] = useState("all_students");
  const [html, setHtml] = useState(STARTER_HTML);
  const [saving, setSaving] = useState(false);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      if (campaignId) {
        await fetch(`/api/platform/campaigns/${campaignId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subject, html, audience }),
        });
      } else {
        const res = await fetch("/api/platform/campaigns", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subject, html, audience }),
        });
        const data = await res.json();
        setCampaignId(data.campaign.id);
      }
      setMessage("Saved");
    } catch {
      setMessage("Error saving");
    }
    setSaving(false);
  }

  async function sendTest() {
    if (!subject || !html) return setMessage("Add subject and html first");
    setSaving(true);
    setMessage("Sending test...");
    try {
      let id = campaignId;
      if (!id) {
        const res = await fetch("/api/platform/campaigns", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subject, html, audience }),
        });
        id = (await res.json()).campaign.id;
        setCampaignId(id);
      }
      const res = await fetch(`/api/platform/campaigns/${id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ test: true }),
      });
      const data = await res.json();
      setMessage(res.ok ? `Test sent (${data.sent})` : `Error: ${data.error}`);
    } catch (err) {
      setMessage(`Error: ${err}`);
    }
    setSaving(false);
  }

  async function sendNow() {
    if (!campaignId) {
      await save();
    }
    if (!confirm(`Send "${subject}" to ${audience.replace(/_/g, " ")}? This cannot be undone.`)) return;
    setSaving(true);
    setMessage("Sending...");
    const id = campaignId;
    if (!id) return;
    const res = await fetch(`/api/platform/campaigns/${id}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (res.ok) {
      setMessage(`Sent to ${data.sent} of ${data.total}`);
      setTimeout(() => router.push("/platform/campaigns"), 1500);
    } else {
      setMessage(`Error: ${data.error}`);
    }
    setSaving(false);
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-6">New Campaign</h1>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Editor */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-wider text-gray-500 font-semibold mb-1">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Your community just leveled up"
              className="w-full px-4 py-2 bg-[#0a0a0a] border border-white/10 rounded-lg text-white"
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-gray-500 font-semibold mb-1">Audience</label>
            <select
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              className="w-full px-4 py-2 bg-[#0a0a0a] border border-white/10 rounded-lg text-white"
            >
              <option value="all_students">All Students</option>
              <option value="all_admins">All Gym Admins</option>
              <optgroup label="Database Leads">
                <option value="database_leads">All Database Leads</option>
                <option value="database_leads_TX">Texas Leads</option>
                <option value="database_leads_CA">California Leads</option>
                <option value="database_leads_FL">Florida Leads</option>
                <option value="database_leads_NY">New York Leads</option>
                <option value="database_leads_NJ">New Jersey Leads</option>
                <option value="database_leads_PA">Pennsylvania Leads</option>
                <option value="database_leads_CO">Colorado Leads</option>
                <option value="database_leads_OR">Oregon Leads</option>
                <option value="database_leads_WA">Washington Leads</option>
                <option value="database_leads_GA">Georgia Leads</option>
                <option value="database_leads_NC">North Carolina Leads</option>
                <option value="database_leads_OH">Ohio Leads</option>
                <option value="database_leads_IL">Illinois Leads</option>
                <option value="database_leads_AZ">Arizona Leads</option>
                <option value="database_leads_MA">Massachusetts Leads</option>
              </optgroup>
              <option value="test">Test (just me)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-gray-500 font-semibold mb-1">HTML</label>
            <textarea
              value={html}
              onChange={(e) => setHtml(e.target.value)}
              rows={22}
              className="w-full px-4 py-3 bg-[#0a0a0a] border border-white/10 rounded-lg text-white font-mono text-xs"
              spellCheck={false}
            />
            <p className="text-gray-600 text-xs mt-1">Tell Claude what you want and paste the HTML it generates here.</p>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <button onClick={save} disabled={saving} className="bg-white/5 hover:bg-white/10 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50">
              {saving ? "Saving..." : "Save Draft"}
            </button>
            <button onClick={sendTest} disabled={saving} className="bg-white/5 hover:bg-white/10 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50">
              Send Test To Me
            </button>
            <button onClick={sendNow} disabled={saving} className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50">
              Send Now
            </button>
            {message && <span className="text-sm text-gray-400">{message}</span>}
          </div>
        </div>

        {/* Preview */}
        <div>
          <label className="block text-xs uppercase tracking-wider text-gray-500 font-semibold mb-1">Preview</label>
          <div className="border border-white/10 rounded-lg overflow-hidden bg-[#0a0a0a] h-[640px]">
            <iframe srcDoc={html} className="w-full h-full" title="Email preview" />
          </div>
        </div>
      </div>
    </div>
  );
}
