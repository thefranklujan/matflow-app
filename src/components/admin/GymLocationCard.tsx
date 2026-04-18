"use client";

import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";

interface GymLocation {
  address: string | null;
  lat: number | null;
  lng: number | null;
  geofenceRadiusM: number;
}

/**
 * Owner-facing geofence setup. Pairs with /api/admin/gym-location:
 *  - address gets geocoded server-side via Nominatim when lat/lng are missing
 *  - the student app pings /api/student/proximity-ping with device lat/lng,
 *    and the server Haversine-checks against these coordinates to log
 *    arrivals and notify the owner.
 */
export default function GymLocationCard() {
  const [loc, setLoc] = useState<GymLocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState<string>("");
  const [lng, setLng] = useState<string>("");
  const [radius, setRadius] = useState(200);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/admin/gym-location", { cache: "no-store" });
        if (!res.ok) {
          if (active) setLoading(false);
          return;
        }
        const data = await res.json();
        if (!active) return;
        const g: GymLocation = data.data || data;
        setLoc(g);
        setAddress(g.address || "");
        setLat(g.lat != null ? String(g.lat) : "");
        setLng(g.lng != null ? String(g.lng) : "");
        setRadius(g.geofenceRadiusM || 200);
      } catch {
        /* noop */
      }
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const body: Record<string, unknown> = {
        address: address.trim() || null,
        geofenceRadiusM: Math.max(50, Math.min(2000, radius || 200)),
      };
      const latN = parseFloat(lat);
      const lngN = parseFloat(lng);
      if (!Number.isNaN(latN) && !Number.isNaN(lngN)) {
        body.lat = latN;
        body.lng = lngN;
      }
      const res = await fetch("/api/admin/gym-location", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMessage(data.error || "Failed to save location");
        setSaving(false);
        return;
      }
      const saved = await res.json();
      const g: GymLocation = saved.data || saved;
      setLoc(g);
      setAddress(g.address || "");
      setLat(g.lat != null ? String(g.lat) : "");
      setLng(g.lng != null ? String(g.lng) : "");
      setRadius(g.geofenceRadiusM || 200);
      setMessage("Saved. Students near the gym will now auto-check-in.");
    } catch {
      setMessage("Network error. Try again.");
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="bg-brand-dark border border-brand-gray rounded-xl p-5 text-gray-400">
        Loading gym location...
      </div>
    );
  }

  const hasCoords = loc?.lat != null && loc?.lng != null;

  return (
    <form onSubmit={save} className="bg-brand-dark border border-brand-gray rounded-xl p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-lg bg-brand-accent/10 text-brand-accent flex items-center justify-center shrink-0">
          <MapPin className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h3 className="text-white font-bold">Gym Location & Geofence</h3>
          <p className="text-gray-500 text-xs mt-0.5">
            When a student with the MatFlow app arrives within your geofence, we log an arrival
            and ping you. Set the address or drop in the coordinates directly.
          </p>
        </div>
        <span
          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded shrink-0 ${
            hasCoords ? "bg-emerald-500/15 text-emerald-400" : "bg-yellow-500/15 text-yellow-400"
          }`}
        >
          {hasCoords ? "Active" : "Not set"}
        </span>
      </div>

      <div>
        <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1">
          Street address
        </label>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="123 Mat Lane, Austin, TX 78701"
          className="w-full px-4 py-3 bg-black border border-white/10 rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:border-brand-accent transition"
        />
        <p className="text-gray-500 text-[11px] mt-1">
          We&apos;ll auto-resolve coordinates from this address when you save, unless you enter
          exact lat/lng below.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1">
            Latitude
          </label>
          <input
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            placeholder="30.2672"
            inputMode="decimal"
            className="w-full px-4 py-3 bg-black border border-white/10 rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:border-brand-accent transition"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1">
            Longitude
          </label>
          <input
            value={lng}
            onChange={(e) => setLng(e.target.value)}
            placeholder="-97.7431"
            inputMode="decimal"
            className="w-full px-4 py-3 bg-black border border-white/10 rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:border-brand-accent transition"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1">
          Geofence radius:{" "}
          <span className="text-white font-semibold normal-case">
            {radius} m ({Math.round(radius * 3.28084)} ft)
          </span>
        </label>
        <input
          type="range"
          min={50}
          max={1000}
          step={25}
          value={radius}
          onChange={(e) => setRadius(Number(e.target.value))}
          className="w-full accent-[#dc2626]"
        />
        <div className="flex justify-between text-[10px] text-gray-600 mt-0.5">
          <span>50 m (small studio)</span>
          <span>1000 m (large campus)</span>
        </div>
      </div>

      {message && (
        <p
          className={`text-sm ${
            message.includes("Saved") ? "text-emerald-400" : "text-red-400"
          }`}
        >
          {message}
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="bg-brand-accent text-brand-black font-bold px-5 py-2.5 rounded-lg transition disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save location"}
      </button>
    </form>
  );
}
