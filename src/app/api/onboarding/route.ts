export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

/**
 * RETIRED: legacy academy-creation endpoint.
 *
 * Owner registration (POST /api/auth/register -> registerGymOwner) already
 * creates the academy AND its owner membership atomically, attaches the academy
 * to the session, and records gym_created. This endpoint created a bare Gym for
 * any valid MatFlow session with no owner membership and no session update,
 * so it could produce orphan or duplicate academy records.
 *
 * It now performs ZERO database work and always answers 410 Gone.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: "Academy setup has moved. Create your academy from the sign-up journey.",
      code: "ONBOARDING_RETIRED",
    },
    { status: 410 },
  );
}
