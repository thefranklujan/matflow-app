import { describe, it, expect } from "vitest";
import { SignJWT } from "jose";
import { JWT_SECRET } from "@/lib/jwt-secret";
import { signArrivalToken, verifyArrivalToken, ArrivalTokenError } from "./arrival-token";

const BINDING = { studentId: "stu_1", memberId: "mem_1", gymId: "gym_1" };

async function expectCode(promise: Promise<unknown>, code: string) {
  const err = await promise.then(
    () => null,
    (e) => e,
  );
  expect(err).toBeInstanceOf(ArrivalTokenError);
  expect((err as ArrivalTokenError).code).toBe(code);
}

describe("arrival attestation", () => {
  it("verifies a fresh token bound to the same student/member/gym", async () => {
    const token = await signArrivalToken(BINDING);
    await expect(verifyArrivalToken(token, BINDING)).resolves.toBeUndefined();
  });

  it("rejects a tampered token", async () => {
    const token = await signArrivalToken(BINDING);
    const tampered = token.slice(0, -4) + "AAAA";
    await expectCode(verifyArrivalToken(tampered, BINDING), "invalid");
  });

  it("rejects an expired token as 'expired' (client refreshes the proximity decision)", async () => {
    const expired = await new SignJWT({ purpose: "arrival-attestation", ...BINDING })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer("matflow")
      .setAudience("matflow-arrival")
      .setIssuedAt(Math.floor(Date.now() / 1000) - 600)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 300)
      .sign(JWT_SECRET);
    await expectCode(verifyArrivalToken(expired, BINDING), "expired");
  });

  it("rejects wrong issuer, audience, and purpose", async () => {
    const wrongIssuer = await new SignJWT({ purpose: "arrival-attestation", ...BINDING })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer("someone-else")
      .setAudience("matflow-arrival")
      .setExpirationTime("5m")
      .sign(JWT_SECRET);
    await expectCode(verifyArrivalToken(wrongIssuer, BINDING), "invalid");

    const wrongAudience = await new SignJWT({ purpose: "arrival-attestation", ...BINDING })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer("matflow")
      .setAudience("matflow-session")
      .setExpirationTime("5m")
      .sign(JWT_SECRET);
    await expectCode(verifyArrivalToken(wrongAudience, BINDING), "invalid");

    const wrongPurpose = await new SignJWT({ purpose: "password-reset", ...BINDING })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer("matflow")
      .setAudience("matflow-arrival")
      .setExpirationTime("5m")
      .sign(JWT_SECRET);
    await expectCode(verifyArrivalToken(wrongPurpose, BINDING), "invalid");
  });

  it("a session-style JWT (no purpose claim) can never pass as an attestation", async () => {
    const sessionish = await new SignJWT({ ...BINDING, role: "member" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("7d")
      .sign(JWT_SECRET);
    await expectCode(verifyArrivalToken(sessionish, BINDING), "invalid");
  });

  it("rejects cross-student, cross-member, and cross-gym bindings", async () => {
    const token = await signArrivalToken(BINDING);
    await expectCode(verifyArrivalToken(token, { ...BINDING, studentId: "stu_2" }), "binding_mismatch");
    await expectCode(verifyArrivalToken(token, { ...BINDING, memberId: "mem_2" }), "binding_mismatch");
    await expectCode(verifyArrivalToken(token, { ...BINDING, gymId: "gym_2" }), "binding_mismatch");
  });
});
