export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { prisma } from "@/lib/prisma";

const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

export async function POST(request: NextRequest) {
  if (!webhookSecret) {
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  const headerPayload = request.headers;
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return NextResponse.json({ error: "Missing svix headers" }, { status: 400 });
  }

  const body = await request.text();
  const wh = new Webhook(webhookSecret);

  let evt: { type: string; data: Record<string, unknown> };
  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as { type: string; data: Record<string, unknown> };
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const { type, data } = evt;

  try {
    switch (type) {
      case "organizationMembership.created": {
        // When a user joins an org, create a Member record
        const orgId = (data.organization as { id: string })?.id;
        const user = data.public_user_data as {
          user_id: string;
          first_name: string;
          last_name: string;
          identifier: string;
        };
        const role = data.role as string;

        if (!orgId || !user?.user_id) break;

        const gym = await prisma.gym.findUnique({
          where: { clerkOrgId: orgId },
        });
        if (!gym) break;

        // Don't create member records for admins (gym owners)
        if (role === "org:admin") break;

        // Create member record if doesn't exist
        await prisma.member.upsert({
          where: {
            gymId_clerkUserId: { gymId: gym.id, clerkUserId: user.user_id },
          },
          create: {
            gymId: gym.id,
            clerkUserId: user.user_id,
            email: user.identifier || "",
            firstName: user.first_name || "",
            lastName: user.last_name || "",
            approved: true,
            active: true,
          },
          update: {
            active: true,
          },
        });
        break;
      }

      case "organizationMembership.deleted": {
        // When a user leaves an org, deactivate their member record
        const orgId = (data.organization as { id: string })?.id;
        const userId = (data.public_user_data as { user_id: string })?.user_id;

        if (!orgId || !userId) break;

        const gym = await prisma.gym.findUnique({
          where: { clerkOrgId: orgId },
        });
        if (!gym) break;

        await prisma.member.updateMany({
          where: { gymId: gym.id, clerkUserId: userId },
          data: { active: false },
        });
        break;
      }

      default:
        // Unhandled event type
        break;
    }
  } catch (error) {
    console.error(`Webhook error (${type}):`, error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
