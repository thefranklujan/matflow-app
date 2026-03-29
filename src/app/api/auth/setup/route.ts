export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { ensureDefaults } from "@/lib/local-auth";

export async function POST() {
  try {
    const gym = await ensureDefaults();
    return NextResponse.json({ success: true, gym: { id: gym.id, name: gym.name } });
  } catch (error) {
    console.error("Setup error:", error);
    return NextResponse.json({ error: "Setup failed" }, { status: 500 });
  }
}
