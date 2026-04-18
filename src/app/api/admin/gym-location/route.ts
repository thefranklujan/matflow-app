export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Gym owner sets their physical gym location + geofence radius.
 * We geocode the address server-side via OpenStreetMap Nominatim (free,
 * no API key required; Google Maps would also work with an API key).
 *
 * Stored on Gym: lat, lng, address, geofenceRadiusM.
 * Students' Capacitor clients compare their current location to the home
 * gym's coords and fire a proximity push if within radius.
 */
export async function GET() {
  try {
    const { gymId } = await requireAdmin();
    const gym = await prisma.gym.findUnique({
      where: { id: gymId },
      select: { lat: true, lng: true, address: true, geofenceRadiusM: true, city: true, state: true, name: true },
    });
    return NextResponse.json(gym);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { gymId } = await requireAdmin();
    const body = await req.json();
    const { address, lat, lng, geofenceRadiusM } = body as {
      address?: string;
      lat?: number | null;
      lng?: number | null;
      geofenceRadiusM?: number;
    };

    let finalLat = typeof lat === "number" ? lat : null;
    let finalLng = typeof lng === "number" ? lng : null;

    // If the client gave us an address but no coords, geocode via Nominatim
    if (address && (finalLat === null || finalLng === null)) {
      try {
        const url = new URL("https://nominatim.openstreetmap.org/search");
        url.searchParams.set("q", address);
        url.searchParams.set("format", "json");
        url.searchParams.set("limit", "1");
        const res = await fetch(url.toString(), {
          headers: { "User-Agent": "MatFlow/1.0 (frank@craftedsystems.io)" },
        });
        if (res.ok) {
          const results = (await res.json()) as Array<{ lat: string; lon: string }>;
          if (results[0]) {
            finalLat = parseFloat(results[0].lat);
            finalLng = parseFloat(results[0].lon);
          }
        }
      } catch (err) {
        console.error("[gym-location] geocode failed:", err);
      }
    }

    const radiusM = Math.max(50, Math.min(2000, geofenceRadiusM ?? 200));

    const gym = await prisma.gym.update({
      where: { id: gymId },
      data: {
        address: address ?? null,
        lat: finalLat,
        lng: finalLng,
        geofenceRadiusM: radiusM,
      },
      select: { lat: true, lng: true, address: true, geofenceRadiusM: true },
    });

    return NextResponse.json(gym);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
