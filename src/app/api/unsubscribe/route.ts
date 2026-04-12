export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyTrackingSignature } from "@/lib/tracking-sig";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("e");
  const sig = searchParams.get("sig");

  if (!email || !sig) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const valid = verifyTrackingSignature({ e: email }, sig);
  if (!valid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  try {
    await prisma.emailUnsubscribe.upsert({
      where: { email },
      update: {},
      create: { email },
    });
  } catch {
    console.error("Failed to process unsubscribe");
  }

  return NextResponse.redirect(new URL(`/unsubscribe?done=1`, request.url));
}
