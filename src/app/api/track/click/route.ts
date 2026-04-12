export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyTrackingSignature } from "@/lib/tracking-sig";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const cid = searchParams.get("cid");
  const email = searchParams.get("e");
  const url = searchParams.get("url");
  const sig = searchParams.get("sig");

  if (!cid || !email || !sig) {
    return NextResponse.redirect("https://mymatflow.com", 302);
  }

  const valid = verifyTrackingSignature({ cid, e: email, url: url || "" }, sig);
  if (!valid) {
    return NextResponse.redirect("https://mymatflow.com", 302);
  }

  try {
    await prisma.campaignEvent.create({
      data: {
        campaignId: cid,
        email,
        event: "click",
        metadata: url || undefined,
      },
    });
  } catch {
    // Log failure but don't block redirect
    console.error("Failed to record click event");
  }

  let redirect = url || "https://mymatflow.com";
  try {
    const parsed = new URL(redirect);
    if (!["http:", "https:"].includes(parsed.protocol)) redirect = "https://mymatflow.com";
  } catch {
    redirect = "https://mymatflow.com";
  }
  return NextResponse.redirect(redirect, 302);
}
