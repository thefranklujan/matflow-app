"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

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

const STATUS_COLORS: Record<string, string> = {
  trialing: "#eab308",
  active: "#10b981",
  free: "#0ea5e9",
};

function FitBounds({ pins }: { pins: GymPin[] }) {
  const map = useMap();
  useEffect(() => {
    const valid = pins.filter(p => p.lat && p.lng);
    if (valid.length === 0) return;
    if (valid.length === 1) {
      map.setView([valid[0].lat!, valid[0].lng!], 12);
    } else {
      map.fitBounds(valid.map(p => [p.lat!, p.lng!] as [number, number]), { padding: [50, 50] });
    }
  }, [pins, map]);
  return null;
}

export default function GymsMapView({ pins }: { pins: GymPin[] }) {
  return (
    <MapContainer
      center={[39.8283, -98.5795]}
      zoom={4}
      style={{ height: "100%", width: "100%", background: "#0a0a0a" }}
      zoomControl={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      <FitBounds pins={pins} />
      {pins.map((pin) => (
        <CircleMarker
          key={pin.id}
          center={[pin.lat!, pin.lng!]}
          radius={8}
          pathOptions={{
            fillColor: STATUS_COLORS[pin.status] || "#c4b5a0",
            fillOpacity: 0.9,
            color: "#ffffff",
            weight: 2,
            opacity: 0.6,
          }}
        >
          <Popup>
            <div style={{ fontFamily: "system-ui", minWidth: "160px" }}>
              <div style={{ fontWeight: 700, fontSize: "14px", marginBottom: "4px", color: "#111" }}>{pin.name}</div>
              {(pin.city || pin.state) && (
                <div style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}>
                  {pin.city}{pin.city && pin.state ? ", " : ""}{pin.state}
                </div>
              )}
              <div style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}>{pin.members} member{pin.members !== 1 ? "s" : ""}</div>
              <span style={{
                fontSize: "10px", fontWeight: 600, textTransform: "uppercase",
                padding: "2px 6px", borderRadius: "4px",
                background: STATUS_COLORS[pin.status] || "#c4b5a0", color: "#fff",
              }}>{pin.status}</span>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
