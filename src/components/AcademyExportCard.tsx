"use client";

import { useState } from "react";
import { Download } from "lucide-react";

/** Owner settings: download the academy's records as one JSON file. */
export default function AcademyExportCard() {
  const [state, setState] = useState<"idle" | "working" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function download() {
    setState("working");
    setMessage("");
    try {
      const res = await fetch("/api/admin/export", { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setState("error");
        setMessage(body.supportExport || body.error || "Export failed. Try again.");
        return;
      }
      const disposition = res.headers.get("Content-Disposition") || "";
      const name = /filename="([^"]+)"/.exec(disposition)?.[1] || "matflow-export.json";
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setState("done");
      setMessage(`Downloaded ${name}. It contains member contact details and signed waivers; store it securely.`);
    } catch {
      setState("error");
      setMessage("Network error. Nothing was exported; try again.");
    }
  }

  return (
    <div className="bg-brand-dark border border-brand-gray rounded-lg p-6">
      <p className="text-gray-300 text-sm mb-1">
        Download your roster, instructors, schedule, attendance, belt history, waivers and signed waiver records as one
        JSON file.
      </p>
      <p className="text-gray-400 text-xs mb-4">
        Students&apos; private training journals and passwords are never included. This is an export only; MatFlow
        cannot restore from it.
      </p>
      <button
        type="button"
        onClick={download}
        disabled={state === "working"}
        className="inline-flex items-center gap-2 border border-white/20 text-white font-semibold px-4 py-2 rounded-lg hover:border-white/40 disabled:opacity-50"
      >
        <Download className="h-4 w-4" aria-hidden />
        {state === "working" ? "Preparing export…" : "Export academy data"}
      </button>
      {message && (
        <p role={state === "error" ? "alert" : "status"} className={`text-sm mt-3 ${state === "error" ? "text-red-300" : "text-green-400"}`}>
          {message}
        </p>
      )}
    </div>
  );
}
