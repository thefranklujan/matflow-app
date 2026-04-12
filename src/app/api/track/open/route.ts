export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyTrackingSignature } from "@/lib/tracking-sig";

// 1x1 transparent PNG
const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const cid = searchParams.get("cid");
  const email = searchParams.get("e");
  const sig = searchParams.get("sig");

  if (cid && email && sig) {
    const valid = verifyTrackingSignature({ cid, e: email }, sig);
    if (valid) {
      try {
        const existing = await prisma.campaignEvent.findFirst({
          where: { campaignId: cid, email, event: "open" },
        });
        if (!existing) {
          await prisma.campaignEvent.create({
            data: { campaignId: cid, email, event: "open" },
          });
        }
      } catch {
        console.error("Failed to record open event");
      }
    }
  }

  return new NextResponse(PIXEL, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
