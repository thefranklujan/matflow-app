"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

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

const STATUS_COLORS: Record<string, string> = {
  lead: "#3b82f6",
  new: "#3b82f6",
  contacted: "#eab308",
  demo: "#a855f7",
  negotiating: "#f97316",
  signed: "#10b981",
  lost: "#ef4444",
};

function FitBounds({ pins }: { pins: Pin[] }) {
  const map = useMap();
  useEffect(() => {
    if (pins.length === 0) return;
    const bounds = pins.map((p) => [p.lat, p.lng] as [number, number]);
    map.fitBounds(bounds, { padding: [30, 30] });
  }, [pins, map]);
  return null;
}

export default function MapView({ pins }: { pins: Pin[] }) {
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
          center={[pin.lat, pin.lng]}
          radius={5}
          pathOptions={{
            fillColor: STATUS_COLORS[pin.status] || "#3b82f6",
            fillOpacity: 0.8,
            color: STATUS_COLORS[pin.status] || "#3b82f6",
            weight: 1,
            opacity: 0.5,
          }}
        >
          <Popup>
            <div style={{ fontFamily: "system-ui", minWidth: "180px" }}>
              <div style={{ fontWeight: 700, fontSize: "14px", marginBottom: "4px", color: "#111" }}>{pin.name}</div>
              {(pin.city || pin.state) && (
                <div style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}>
                  {pin.city}{pin.city && pin.state ? ", " : ""}{pin.state}
                </div>
              )}
              {pin.rating && (
                <div style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}>
                  Rating: {pin.rating}
                </div>
              )}
              {pin.email && (
                <div style={{ fontSize: "12px", marginBottom: "2px" }}>
                  <a href={`mailto:${pin.email}`} style={{ color: "#2563eb" }}>{pin.email}</a>
                </div>
              )}
              {pin.phone && (
                <div style={{ fontSize: "12px", color: "#666" }}>{pin.phone}</div>
              )}
              <div style={{ marginTop: "6px" }}>
                <span style={{
                  fontSize: "10px",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  background: STATUS_COLORS[pin.status] || "#3b82f6",
                  color: "#fff",
                }}>{pin.status === "new" ? "lead" : pin.status}</span>
              </div>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
