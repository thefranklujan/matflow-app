"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, MapPin } from "lucide-react";
import Link from "next/link";

interface GymPin {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  status: string;
  approved: boolean;
  members: number;
  query: string;
}

const STATUS_COLORS: Record<string, string> = {
  trialing: "#eab308",
  active: "#10b981",
  free: "#0ea5e9",
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
          <h1 className="text-xl font-bold text-white">Active Gyms Map</h1>
          {!loading && (
            <span className="text-xs text-gray-500 bg-white/5 px-2 py-1 rounded-full">{pins.length} gyms</span>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center" style={{ height: "calc(100vh - 200px)" }}>
          <div className="text-gray-500 text-sm">Loading...</div>
        </div>
      ) : (
        <div className="border border-white/10 rounded-xl overflow-hidden" style={{ height: "calc(100vh - 200px)" }}>
          <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
            {/* Gym list with map links */}
            <div className="flex-1 overflow-y-auto" style={{ padding: "16px" }}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {pins.map(pin => {
                  const color = STATUS_COLORS[pin.status] || "#737373";
                  return (
                    <a
                      key={pin.id}
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pin.query)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-[#111] border border-white/10 rounded-xl hover:border-white/20 transition block"
                      style={{ padding: "16px" }}
                    >
                      <div className="flex items-center gap-3" style={{ marginBottom: "8px" }}>
                        <div style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: color, flexShrink: 0 }} />
                        <div className="text-sm font-semibold text-white truncate">{pin.name}</div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">
                          {pin.city}{pin.city && pin.state ? ", " : ""}{pin.state}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-600">{pin.members} members</span>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded capitalize`} style={{ backgroundColor: `${color}20`, color }}>{pin.status}</span>
                        </div>
                      </div>
                    </a>
                  );
                })}
              </div>
              {pins.length === 0 && (
                <div className="text-center text-gray-500 text-sm" style={{ paddingTop: "64px" }}>No active gyms yet.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
