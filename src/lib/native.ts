import { cookies, headers } from "next/headers";

/**
 * Server-authoritative native (iOS/Android shell) detection for Server
 * Components. Capacitor appends "MatFlowNative" to the WebView User-Agent, so
 * this is correct on the FIRST byte — no first-paint cookie race. The
 * matflow-native cookie is kept as defense-in-depth.
 *
 * Used to keep the native shell student-only: hide gym-owner trial pitches,
 * billing language, and any paid-subscription marketing (App Store 3.1.1).
 */
export async function isNativeRequest(): Promise<boolean> {
  try {
    const h = await headers();
    const ua = h.get("user-agent") || "";
    if (ua.includes("MatFlowNative")) return true;
  } catch {
    // headers() can throw outside a request scope
  }
  try {
    const c = await cookies();
    if (c.get("matflow-native")?.value === "1") return true;
  } catch {
    // cookies() can throw outside a request scope
  }
  return false;
}
