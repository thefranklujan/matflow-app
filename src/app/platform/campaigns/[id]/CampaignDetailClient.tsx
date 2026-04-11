"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Trash2 } from "lucide-react";

interface Campaign {
  id: string;
  subject: string;
  html: string;
  audience: string;
  status: string;
  sentCount: number;
  sentAt: string | null;
  createdAt: string;
}

export default function CampaignDetailClient({ campaign: initial }: { campaign: Campaign }) {
  const router = useRouter();
  const [campaign, setCampaign] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [recipientCount, setRecipientCount] = useState<number | null>(null);

  useEffect(() => {
    fetch(`/api/platform/campaigns/audience-count?audience=${campaign.audience}`)
      .then(r => r.json())
      .then(d => setRecipientCount(d.count ?? null))
      .catch(() => setRecipientCount(null));
  }, [campaign.audience]);

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/platform/campaigns/${campaign.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: campaign.subject, html: campaign.html, audience: campaign.audience }),
    });
    setSaving(false);
    setMessage(res.ok ? "Saved" : "Error saving");
    if (res.ok) setEditing(false);
  }

  async function sendTest() {
    setSaving(true);
    setMessage("Sending test...");
    const res = await fetch(`/api/platform/campaigns/${campaign.id}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ test: true }),
    });
    const data = await res.json();
    setMessage(res.ok ? `Test sent (${data.sent})` : `Error: ${data.error}`);
    setSaving(false);
  }

  async function sendNow() {
    if (!confirm(`Send "${campaign.subject}" to ${campaign.audience.replace(/_/g, " ")}? This cannot be undone.`)) return;
    setSaving(true);
    setMessage("Sending...");
    const res = await fetch(`/api/platform/campaigns/${campaign.id}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (res.ok) {
      setMessage(`Sent to ${data.sent} of ${data.total}`);
      setCampaign({ ...campaign, status: "sent", sentCount: campaign.sentCount + data.sent, sentAt: new Date().toISOString() });
    } else {
      setMessage(`Error: ${data.error}`);
    }
    setSaving(false);
  }

  async function remove() {
    if (!confirm("Delete this campaign?")) return;
    const res = await fetch(`/api/platform/campaigns/${campaign.id}`, { method: "DELETE" });
    if (res.ok) router.push("/platform/campaigns");
  }

  return (
    <div>
      <Link href="/platform/campaigns" className="inline-flex items-center gap-1 text-gray-500 hover:text-white text-sm mb-4">
        <ArrowLeft className="h-4 w-4" /> All Campaigns
      </Link>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          {editing ? (
            <input
              value={campaign.subject}
              onChange={(e) => setCampaign({ ...campaign, subject: e.target.value })}
              className="text-3xl font-bold bg-transparent text-white border-b border-white/10 focus:outline-none focus:border-orange-500"
            />
          ) : (
            <h1 className="text-3xl font-bold text-white">{campaign.subject}</h1>
          )}
          <div className="text-gray-500 text-sm mt-1 flex items-center gap-3">
            <span className="capitalize">{campaign.audience.replace(/_/g, " ")}</span>
            {recipientCount !== null && (
              <span className="text-orange-400 font-semibold">{recipientCount.toLocaleString()} recipients</span>
            )}
            <span>·</span>
            <span className={campaign.status === "sent" ? "text-green-400" : ""}>{campaign.status}</span>
            {campaign.sentCount > 0 && <><span>·</span><span>{campaign.sentCount} sent</span></>}
          </div>
        </div>
        <button onClick={remove} className="text-gray-600 hover:text-red-400 transition" title="Delete">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="space-y-4">
          {editing && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs uppercase tracking-wider text-gray-500 font-semibold">Audience</label>
                {recipientCount !== null && (
                  <span className="text-xs text-orange-400 font-semibold">{recipientCount.toLocaleString()} recipients</span>
                )}
              </div>
              <select
                value={campaign.audience}
                onChange={(e) => setCampaign({ ...campaign, audience: e.target.value })}
                className="w-full px-4 py-2 bg-[#0a0a0a] border border-white/10 rounded-lg text-white"
              >
                <option value="all_students">All Students</option>
                <option value="all_admins">All Gym Admins</option>
                <optgroup label="Database Leads">
                  <option value="database_leads_unsent">Unsent Leads Only</option>
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
          )}
          <div>
            <label className="block text-xs uppercase tracking-wider text-gray-500 font-semibold mb-1">HTML</label>
            <textarea
              value={campaign.html}
              onChange={(e) => setCampaign({ ...campaign, html: e.target.value })}
              readOnly={!editing}
              rows={22}
              className="w-full px-4 py-3 bg-[#0a0a0a] border border-white/10 rounded-lg text-white font-mono text-xs"
              spellCheck={false}
            />
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            {editing ? (
              <>
                <button onClick={save} disabled={saving} className="bg-white/5 hover:bg-white/10 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50">
                  {saving ? "Saving..." : "Save"}
                </button>
                <button onClick={() => setEditing(false)} className="text-gray-400 hover:text-white text-sm px-3 py-2">Cancel</button>
              </>
            ) : (
              <button onClick={() => setEditing(true)} className="bg-white/5 hover:bg-white/10 text-white text-sm font-semibold px-4 py-2 rounded-lg">
                Edit
              </button>
            )}
            <button onClick={sendTest} disabled={saving} className="bg-white/5 hover:bg-white/10 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50">
              Send Test To Me
            </button>
            <button onClick={sendNow} disabled={saving} className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50">
              Send Now
            </button>
            {campaign.status === "sent" && (
              <Link href={`/platform/campaigns/${campaign.id}/report`} className="bg-white/5 hover:bg-white/10 text-white text-sm font-semibold px-4 py-2 rounded-lg">
                View Report
              </Link>
            )}
            {message && <span className="text-sm text-gray-400">{message}</span>}
          </div>
        </div>

        <div>
          <label className="block text-xs uppercase tracking-wider text-gray-500 font-semibold mb-1">Preview</label>
          <div className="border border-white/10 rounded-lg overflow-hidden bg-[#0a0a0a] h-[640px]">
            <iframe srcDoc={campaign.html} className="w-full h-full" title="Email preview" />
          </div>
        </div>
      </div>
    </div>
  );
}
