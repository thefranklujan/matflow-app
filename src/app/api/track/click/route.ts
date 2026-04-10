export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const cid = searchParams.get("cid");
  const email = searchParams.get("e");
  const url = searchParams.get("url");

  if (cid && email) {
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
      // Silently fail
    }
  }

  const redirect = url || "https://mymatflow.com";
  return NextResponse.redirect(redirect, 302);
}
