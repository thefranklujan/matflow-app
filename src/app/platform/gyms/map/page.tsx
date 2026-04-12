"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, MapPin, ExternalLink } from "lucide-react";
import Link from "next/link";

interface GymPin {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  status: string;
  members: number;
  query: string;
}

const STATUS_COLORS: Record<string, { bg: string; dot: string; text: string }> = {
  trialing: { bg: "bg-yellow-500/10", dot: "#eab308", text: "text-yellow-400" },
  active: { bg: "bg-emerald-500/10", dot: "#10b981", text: "text-emerald-400" },
  free: { bg: "bg-sky-500/10", dot: "#0ea5e9", text: "text-sky-400" },
};

export default function GymsMapPage() {
  const [pins, setPins] = useState<GymPin[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/platform/gyms/map")
      .then(r => r.json())
      .then(d => { setPins(d.pins || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between" style={{ marginBottom: "16px" }}>
        <Link href="/platform/gyms" className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition">
          <ArrowLeft className="h-4 w-4" /> Back to Gyms
        </Link>
        <div className="flex items-center gap-3">
          <MapPin className="h-5 w-5 text-brand-accent" />
          <h1 className="text-xl font-bold text-white">Active Gyms</h1>
          <span className="text-xs text-gray-500 bg-white/5 px-2 py-1 rounded-full">{pins.length} gyms</span>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center" style={{ height: "calc(100vh - 200px)" }}>
          <div className="text-gray-500 text-sm">Loading...</div>
        </div>
      ) : pins.length === 0 ? (
        <div className="flex items-center justify-center" style={{ height: "calc(100vh - 200px)" }}>
          <div className="text-gray-500 text-sm">No active gyms yet.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pins.map(pin => {
            const colors = STATUS_COLORS[pin.status] || STATUS_COLORS.trialing;
            const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pin.query)}`;
            return (
              <div key={pin.id} className="bg-[#111] border border-white/10 rounded-xl overflow-hidden hover:border-white/20 transition">
                {/* Map preview */}
                <div style={{ height: "200px", position: "relative" }}>
                  <iframe
                    src={`https://maps.google.com/maps?q=${encodeURIComponent(pin.query)}&output=embed&z=14`}
                    width="100%"
                    height="100%"
                    style={{ border: 0, filter: "invert(90%) hue-rotate(180deg) contrast(0.9)" }}
                    loading="lazy"
                  />
                </div>
                {/* Info */}
                <div style={{ padding: "16px 20px" }}>
                  <div className="flex items-center justify-between" style={{ marginBottom: "8px" }}>
                    <div className="flex items-center gap-3">
                      <div style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: colors.dot }} />
                      <span className="text-base font-semibold text-white">{pin.name}</span>
                    </div>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded capitalize ${colors.bg} ${colors.text}`}>{pin.status}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">{pin.city || ""}{pin.city && pin.state ? ", " : ""}{pin.state || ""} &middot; {pin.members} member{pin.members !== 1 ? "s" : ""}</span>
                    <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-brand-accent hover:underline">
                      <ExternalLink className="h-3 w-3" /> Google Maps
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
