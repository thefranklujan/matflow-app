export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const email = new URL(request.url).searchParams.get("e");
  if (!email) return NextResponse.json({ error: "Missing email" }, { status: 400 });

  try {
    await prisma.emailUnsubscribe.upsert({
      where: { email },
      update: {},
      create: { email },
    });
  } catch {}

  // Redirect to unsubscribe confirmation page
  return NextResponse.redirect(new URL(`/unsubscribe?done=1`, request.url));
}
