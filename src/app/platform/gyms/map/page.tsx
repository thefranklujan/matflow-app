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
  status: string;
  members: number;
  lat?: number;
  lng?: number;
}

export default function GymsMapPage() {
  const [pins, setPins] = useState<GymPin[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/platform/gyms/map")
      .then(r => r.json())
      .then(async (d) => {
        const gyms = d.pins || [];
        // Geocode each gym using Nominatim (free, no API key)
        const geocoded: GymPin[] = [];
        for (const gym of gyms) {
          try {
            const q = encodeURIComponent(`${gym.name} ${gym.city || ""} ${gym.state || ""}`);
            const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=us`);
            const results = await res.json();
            if (results.length > 0) {
              geocoded.push({ ...gym, lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) });
            } else {
              geocoded.push(gym);
            }
          } catch {
            geocoded.push(gym);
          }
          // Nominatim rate limit: 1 req/sec
          await new Promise(r => setTimeout(r, 1100));
        }
        setPins(geocoded);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const mappedPins = pins.filter(p => p.lat && p.lng);

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
            <span className="text-xs text-gray-500 bg-white/5 px-2 py-1 rounded-full">{mappedPins.length} gyms</span>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center" style={{ height: "calc(100vh - 200px)" }}>
          <div className="text-gray-500 text-sm">Locating {pins.length > 0 ? `${pins.filter(p => p.lat).length}/${pins.length}` : ""} gyms...</div>
        </div>
      ) : mappedPins.length === 0 ? (
        <div className="flex items-center justify-center" style={{ height: "calc(100vh - 200px)" }}>
          <div className="text-gray-500 text-sm">No gyms could be located on the map.</div>
        </div>
      ) : (
        <div className="border border-white/10 rounded-xl overflow-hidden" style={{ height: "calc(100vh - 200px)" }}>
          <GymsMapView pins={mappedPins} />
        </div>
      )}
    </div>
  );
}
