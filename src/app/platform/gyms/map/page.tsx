"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, MapPin } from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";

const GymsMapView = dynamic(() => import("./GymsMapView"), { ssr: false });

interface GymPin {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  lat: number | null;
  lng: number | null;
  status: string;
  members: number;
  query: string;
}

export default function GymsMapPage() {
  const [pins, setPins] = useState<GymPin[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/platform/gyms/map")
      .then(r => r.json())
      .then(async (d) => {
        const gyms: GymPin[] = d.pins || [];

        // Geocode gyms that don't have lat/lng
        for (const gym of gyms) {
          if (gym.lat && gym.lng) continue;
          try {
            const q = encodeURIComponent(gym.query);
            const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=us`);
            const results = await res.json();
            if (results.length > 0) {
              gym.lat = parseFloat(results[0].lat);
              gym.lng = parseFloat(results[0].lon);
            }
            await new Promise(r => setTimeout(r, 1100));
          } catch {}
        }

        setPins(gyms);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const mappedPins = pins.filter(p => p.lat && p.lng);
  const unmappedPins = pins.filter(p => !p.lat || !p.lng);

  return (
    <div>
      <div className="flex items-center justify-between" style={{ marginBottom: "16px" }}>
        <Link href="/platform/gyms" className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition">
          <ArrowLeft className="h-4 w-4" /> Back to Gyms
        </Link>
        <div className="flex items-center gap-3">
          <MapPin className="h-5 w-5 text-brand-accent" />
          <h1 className="text-xl font-bold text-white">Active Gyms Map</h1>
          <span className="text-xs text-gray-500 bg-white/5 px-2 py-1 rounded-full">{pins.length} gyms</span>
        </div>
      </div>

      <div className="border border-white/10 rounded-xl overflow-hidden" style={{ height: "calc(100vh - 200px)" }}>
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-500 text-sm">Locating gyms...</div>
          </div>
        ) : mappedPins.length > 0 ? (
          <GymsMapView pins={mappedPins} />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-gray-500 text-sm" style={{ marginBottom: "8px" }}>No gyms could be located on the map yet.</div>
              <div className="text-gray-600 text-xs">Gyms need a city and state set in their settings to appear here.</div>
            </div>
          </div>
        )}
      </div>

      {unmappedPins.length > 0 && (
        <div style={{ marginTop: "16px" }}>
          <p className="text-xs text-gray-600" style={{ marginBottom: "8px" }}>{unmappedPins.length} gym{unmappedPins.length !== 1 ? "s" : ""} could not be located: {unmappedPins.map(p => p.name).join(", ")}</p>
        </div>
      )}
    </div>
  );
}
