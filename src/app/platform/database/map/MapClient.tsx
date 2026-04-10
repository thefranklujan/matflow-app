"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, MapPin } from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";

const MapView = dynamic(() => import("./MapView"), { ssr: false });

interface Pin {
  id: string;
  name: string;
  lat: number;
  lng: number;
  city: string | null;
  state: string | null;
  status: string;
  rating: number | null;
  email: string | null;
  phone: string | null;
}

export default function MapClient() {
  const [pins, setPins] = useState<Pin[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/database?mapPins=true")
      .then((r) => r.json())
      .then((data) => {
        setPins(data.pins || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between" style={{ marginBottom: "16px" }}>
        <div className="flex items-center gap-3">
          <Link
            href="/platform/database"
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Database
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <MapPin className="h-5 w-5 text-brand-accent" />
          <h1 className="text-xl font-bold text-white">Gym Map</h1>
          {!loading && (
            <span className="text-xs text-gray-500 bg-white/5 px-2 py-1 rounded-full">
              {pins.length.toLocaleString()} pinned
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center" style={{ height: "calc(100vh - 200px)" }}>
          <div className="text-gray-500 text-sm">Loading map...</div>
        </div>
      ) : (
        <div className="border border-white/10 rounded-xl overflow-hidden" style={{ height: "calc(100vh - 200px)" }}>
          <MapView pins={pins} />
        </div>
      )}
    </div>
  );
}
