"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Check } from "lucide-react";

interface DropIn {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  emergencyName: string | null;
  emergencyPhone: string | null;
  classType: string | null;
  instructorName: string | null;
  visitDate: string;
  waiverSigned: boolean;
  converted: boolean;
}

export default function DropInsClient({
  initial,
  gymSlug,
}: {
  initial: DropIn[];
  gymSlug: string | null;
}) {
  const router = useRouter();
  const [dropIns, setDropIns] = useState<DropIn[]>(initial);
  const [copied, setCopied] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const dropInUrl = gymSlug ? `https://app.mymatflow.com/dropin/${gymSlug}` : "";

  function copyLink() {
    if (!dropInUrl) return;
    navigator.clipboard.writeText(dropInUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function convert(d: DropIn) {
    if (!confirm(`Convert ${d.firstName} ${d.lastName} into a member?`)) return;
    setBusyId(d.id);
    setError("");
    const res = await fetch(`/api/admin/dropins/${d.id}/convert`, { method: "POST" });
    setBusyId(null);
    if (res.ok) {
      setDropIns((prev) => prev.map((x) => (x.id === d.id ? { ...x, converted: true } : x)));
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Could not convert drop-in");
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Drop-ins</h1>

      {/* Shareable QR/link */}
      {dropInUrl && (
        <div className="bg-brand-dark border border-brand-gray rounded-lg p-5 mb-6">
          <p className="text-sm font-semibold text-white mb-1">Drop-in check-in link</p>
          <p className="text-xs text-gray-500 mb-3">
            Share this link or print it as a QR code at your front desk. Visitors fill out their info and sign your waiver before class.
          </p>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={dropInUrl}
              onClick={(e) => (e.target as HTMLInputElement).select()}
              className="flex-1 bg-brand-black border border-brand-gray rounded-lg px-3 py-2 text-sm text-gray-400 focus:outline-none"
            />
            <button
              onClick={copyLink}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                copied ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" : "bg-brand-accent text-brand-black hover:opacity-90"
              }`}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-sm mb-4">
          {error}
        </div>
      )}

      <div className="bg-brand-dark border border-brand-gray rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-brand-gray">
              <th className="text-left text-xs text-gray-400 uppercase tracking-wider px-4 py-3">Name</th>
              <th className="text-left text-xs text-gray-400 uppercase tracking-wider px-4 py-3">Date</th>
              <th className="text-left text-xs text-gray-400 uppercase tracking-wider px-4 py-3">Contact</th>
              <th className="text-left text-xs text-gray-400 uppercase tracking-wider px-4 py-3">Class</th>
              <th className="text-left text-xs text-gray-400 uppercase tracking-wider px-4 py-3">Waiver</th>
              <th className="text-right text-xs text-gray-400 uppercase tracking-wider px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {dropIns.map((d) => (
              <tr key={d.id} className="border-b border-brand-gray/50 hover:bg-brand-gray/20 transition">
                <td className="px-4 py-3 text-sm text-white font-medium">
                  {d.firstName} {d.lastName}
                  {d.emergencyName && (
                    <div className="text-xs text-gray-500">ICE: {d.emergencyName} {d.emergencyPhone || ""}</div>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-400">
                  {new Date(d.visitDate).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-sm text-gray-400">
                  {d.email || d.phone || "—"}
                </td>
                <td className="px-4 py-3 text-sm text-gray-400">
                  {d.classType || "—"}
                  {d.instructorName && <span className="text-gray-600"> · {d.instructorName}</span>}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full ${d.waiverSigned ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"}`}>
                    {d.waiverSigned ? "Signed" : "Unsigned"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {d.converted ? (
                    <span className="text-xs text-gray-500">Member</span>
                  ) : (
                    <button
                      onClick={() => convert(d)}
                      disabled={busyId === d.id}
                      className="text-sm text-brand-accent hover:underline disabled:opacity-50"
                    >
                      {busyId === d.id ? "Converting..." : "Convert to member"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {dropIns.length === 0 && (
          <div className="text-center py-8 text-gray-500 text-sm">
            No drop-ins yet. Share your check-in link to start capturing visitors.
          </div>
        )}
      </div>
    </div>
  );
}
