export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { registerGymOwner, createSession, DuplicateRegistrationError } from "@/lib/local-auth";
import { sendWelcomeEmail, notifyFrankNewGymPending } from "@/lib/email";
import { validateOwnerRegistration } from "@/lib/owner-registration";

export async function POST(request: NextRequest) {
  // Academy owner accounts are a paid, web-only product. Never allow owner
  // (gym) creation from the native iOS/Android shell (App Store 3.1.1).
  const ua = request.headers.get("user-agent") || "";
  const nativeCookie = request.cookies.get("matflow-native")?.value === "1";
  if (ua.includes("MatFlowNative") || nativeCookie) {
    return NextResponse.json(
      {
        error: "Academy owners set up their gym on the web at app.mymatflow.com.",
        code: "NATIVE_NOT_SUPPORTED",
      },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON.", code: "INVALID_BODY", field: "body" },
      { status: 400 },
    );
  }

  // Validate everything BEFORE any database work, so an invalid submission can
  // never leave a partial academy behind.
  const validated = validateOwnerRegistration(body);
  if (!validated.ok) {
    return NextResponse.json(
      { error: validated.error.message, code: validated.error.code, field: validated.error.field },
      { status: 400 },
    );
  }
  const input = validated.value;

  let result;
  try {
    result = await registerGymOwner({
      email: input.email,
      phone: input.phone ?? undefined,
      password: input.password,
      firstName: input.firstName,
      lastName: input.lastName,
      gymName: input.gymName,
      gymSlug: input.gymSlug,
      timezone: input.timezone,
    });
  } catch (error) {
    if (error instanceof DuplicateRegistrationError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.field === "email" ? "EMAIL_TAKEN" : "SLUG_TAKEN",
          field: error.field,
        },
        { status: 409 },
      );
    }
    // Never surface a raw Prisma/database error. Details stay in the server
    // log (no payload, no password); the caller gets a stable, safe message.
    console.error("Owner registration failed", {
      code: (error as { code?: string })?.code,
      name: (error as { name?: string })?.name,
    });
    return NextResponse.json(
      { error: "We could not create your academy. Please try again.", code: "REGISTRATION_FAILED" },
      { status: 500 },
    );
  }

  // The academy, owner membership, and gym_created row are already committed.
  // If the session cookie cannot be written we must NOT imply the registration
  // can be retried — the account exists. Tell the owner to sign in instead.
  try {
    await createSession({
      userId: `owner-${result.member.id}`,
      email: input.email,
      name: `${input.firstName} ${input.lastName}`,
      role: "admin",
      gymId: result.gym.id,
      memberId: result.member.id,
    });
  } catch (err) {
    console.error("session creation failed after successful registration", {
      name: (err as { name?: string })?.name,
    });
    return NextResponse.json(
      {
        success: true,
        gym: result.gym,
        code: "SESSION_NOT_CREATED",
        signInRequired: true,
        error: "Your academy was created. Please sign in to continue.",
      },
      { status: 201 },
    );
  }

  // Notifications are best-effort: a mail failure must never invalidate an
  // academy that already exists.
  void Promise.resolve(
    sendWelcomeEmail(input.email, `${input.firstName} ${input.lastName}`, input.gymName),
  ).catch(() => {});
  void Promise.resolve(
    notifyFrankNewGymPending({
      gymName: input.gymName,
      ownerName: `${input.firstName} ${input.lastName}`,
      ownerEmail: input.email,
      ownerPhone: input.phone ?? undefined,
    }),
  ).catch(() => {});

  return NextResponse.json({ success: true, gym: result.gym }, { status: 201 });
}
