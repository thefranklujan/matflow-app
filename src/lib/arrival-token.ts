import { SignJWT, jwtVerify } from "jose";
import { JWT_SECRET } from "@/lib/jwt-secret";

/**
 * Short-lived signed "arrival attestation": proof that THIS student's THIS
 * membership was verified inside THIS gym's geofence moments ago.
 *
 * Deliberately narrow:
 * - 5-minute lifetime; strict issuer/audience/purpose so it can never pass
 *   as a session cookie (sessions have no purpose claim and a different shape).
 * - Bound to studentId + memberId + gymId; the check-in endpoint re-verifies
 *   all three against the freshly-resolved membership.
 * - Carries NO latitude, longitude, or raw accuracy — only the yes/no fact.
 */

const ISSUER = "matflow";
const AUDIENCE = "matflow-arrival";
const PURPOSE = "arrival-attestation";
export const ARRIVAL_TOKEN_TTL_SECONDS = 5 * 60;

export interface ArrivalClaims {
  studentId: string;
  memberId: string;
  gymId: string;
}

export async function signArrivalToken(claims: ArrivalClaims): Promise<string> {
  return new SignJWT({ purpose: PURPOSE, ...claims })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${ARRIVAL_TOKEN_TTL_SECONDS}s`)
    .sign(JWT_SECRET);
}

export class ArrivalTokenError extends Error {
  constructor(public code: "invalid" | "expired" | "binding_mismatch") {
    super(code);
    this.name = "ArrivalTokenError";
  }
}

/**
 * Verify the attestation AND its binding to the currently-resolved membership.
 * Every failure (tampered, expired, wrong issuer/audience/purpose, or a token
 * minted for a different student/member/gym) fails closed.
 */
export async function verifyArrivalToken(token: string, expected: ArrivalClaims): Promise<void> {
  let payload: Record<string, unknown>;
  try {
    const result = await jwtVerify(token, JWT_SECRET, {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ["HS256"],
    });
    payload = result.payload as Record<string, unknown>;
  } catch (err) {
    const isExpired = err instanceof Error && err.name === "JWTExpired";
    throw new ArrivalTokenError(isExpired ? "expired" : "invalid");
  }

  if (payload.purpose !== PURPOSE) {
    throw new ArrivalTokenError("invalid");
  }
  if (
    payload.studentId !== expected.studentId ||
    payload.memberId !== expected.memberId ||
    payload.gymId !== expected.gymId
  ) {
    throw new ArrivalTokenError("binding_mismatch");
  }
}
