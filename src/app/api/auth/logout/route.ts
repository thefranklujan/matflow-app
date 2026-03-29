export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { destroySession } from "@/lib/local-auth";

export async function POST() {
  await destroySession();
  return NextResponse.json({ success: true });
}
