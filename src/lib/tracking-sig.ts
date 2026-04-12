import { createHmac } from "crypto";

const SECRET = process.env.TRACKING_HMAC_SECRET || process.env.NEXTAUTH_SECRET || "matflow-tracking-default-key";

export function signTrackingParams(params: Record<string, string>): string {
  const sorted = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join("&");
  return createHmac("sha256", SECRET).update(sorted).digest("hex").slice(0, 16);
}

export function verifyTrackingSignature(params: Record<string, string>, sig: string): boolean {
  const expected = signTrackingParams(params);
  return expected === sig;
}
