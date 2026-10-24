"use client";

import { useCallback, useEffect, useId, useState } from "react";

type Status = "none_required" | "unsigned" | "previous_version_signed" | "current_signed";

interface WaiverState {
  status: Status;
  template: { id: string; title: string; content: string; version: number } | null;
  signedAt: string | null;
  previous: { version: number; signedAt: string } | null;
}

function day(iso: string) {
  return new Date(iso).toLocaleDateString();
}

/**
 * Review/sign the academy's CURRENT waiver. Shared by the member pages and
 * the student academy view; `endpoint` serves GET (status) and POST (sign)
 * with the src/lib/waiver.ts contract. Describes record status only — never
 * legal coverage.
 */
export default function WaiverPanel({ endpoint, compact = false }: { endpoint: string; compact?: boolean }) {
  const [data, setData] = useState<WaiverState | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [signedName, setSignedName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The student shell renders page content in both a desktop and a mobile
  // tree, so element ids must be unique per instance.
  const nameId = useId();

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      const res = await fetch(endpoint, { cache: "no-store" });
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch {
      setLoadError(true);
    }
  }, [endpoint]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSign(e: React.FormEvent) {
    e.preventDefault();
    if (!data?.template || !signedName.trim() || !agreed || submitting) return;
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: data.template.id,
          version: data.template.version,
          signedName: signedName.trim(),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        setData({ ...data, status: "current_signed", signedAt: body.signedAt, previous: null });
      } else if (res.status === 409 && body.current) {
        // The waiver changed while it was open: show the new text, require a
        // fresh agreement, and never record a signature for unseen content.
        setData(body.current);
        setAgreed(false);
        setNotice(body.error || "This waiver was updated. Review the new version before signing.");
      } else {
        setError(body.error || "Could not sign the waiver. Try again.");
      }
    } catch {
      setError("Network error. Your signature was not recorded; try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loadError) {
    return (
      <div role="alert" className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-sm text-red-300">
        Could not load the waiver.{" "}
        <button type="button" onClick={load} className="underline">
          Try again
        </button>
      </div>
    );
  }
  if (!data) return <p className="text-gray-400 text-sm" role="status">Loading waiver…</p>;

  if (!data.template || data.status === "none_required") {
    return <p className="text-gray-400 text-sm">No waiver is currently required by this academy.</p>;
  }

  if (data.status === "current_signed") {
    return (
      <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4" role="status">
        <p className="text-green-400 font-medium">
          You signed the current version (v{data.template.version}) of {data.template.title}
        </p>
        {data.signedAt && <p className="text-gray-400 text-sm mt-1">Signed on {day(data.signedAt)}</p>}
      </div>
    );
  }

  return (
    <div>
      {!compact && <h2 className="text-xl font-bold text-white mb-1">{data.template.title}</h2>}
      <p className="text-amber-300 text-sm mb-4" role="status">
        {data.status === "previous_version_signed" && data.previous
          ? `Updated waiver available. You signed version ${data.previous.version} on ${day(data.previous.signedAt)}; version ${data.template.version} needs your signature.`
          : `Your signature is needed for version ${data.template.version} of this waiver.`}
      </p>
      {notice && (
        <p role="alert" className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-sm text-amber-200 mb-4">
          {notice}
        </p>
      )}
      <div className="bg-black/40 border border-white/10 rounded-lg p-4 mb-4 max-h-80 overflow-y-auto" tabIndex={0} aria-label="Waiver text">
        <p className="text-gray-300 text-sm whitespace-pre-line">{data.template.content}</p>
      </div>
      <form onSubmit={handleSign} className="space-y-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-1 h-4 w-4"
          />
          <span className="text-gray-300 text-sm">I have read and agree to version {data.template.version} of this waiver</span>
        </label>
        <div>
          <label htmlFor={nameId} className="block text-sm font-medium text-gray-300 mb-1">
            Type your full name to sign
          </label>
          <input
            id={nameId}
            type="text"
            autoComplete="name"
            value={signedName}
            onChange={(e) => setSignedName(e.target.value)}
            className="w-full px-4 py-3 bg-black border border-white/15 rounded-lg text-white italic text-lg"
            placeholder="Your full name"
            required
          />
        </div>
        {error && (
          <p role="alert" className="text-red-300 text-sm">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={submitting || !agreed || !signedName.trim()}
          className="w-full bg-[#dc2626] hover:bg-[#b91c1c] text-white font-bold py-3 rounded-lg disabled:opacity-50"
        >
          {submitting ? "Signing…" : `Sign version ${data.template.version}`}
        </button>
      </form>
    </div>
  );
}
