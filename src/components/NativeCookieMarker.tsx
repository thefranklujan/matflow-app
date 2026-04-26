"use client";

import { useEffect } from "react";

/**
 * Sets a long lived "matflow-native=1" cookie on the very first paint when
 * the app is running inside the Capacitor iOS shell. The server uses this
 * cookie to skip any gym owner subscription oriented routes and copy and
 * send users straight to the web only landing, without a flash of the
 * owner dashboard or marketing homepage.
 *
 * Web browsers never run this branch (Capacitor is undefined), so the
 * cookie is iOS only.
 */
export default function NativeCookieMarker() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const isNative =
      (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } })
        .Capacitor?.isNativePlatform?.() || false;
    if (!isNative) return;
    if (document.cookie.includes("matflow-native=1")) return;
    // 365 day cookie. Marker is harmless and helpful across the whole
    // session lifetime even if the user kills and relaunches the app.
    document.cookie = "matflow-native=1; Path=/; Max-Age=31536000; SameSite=Lax";
  }, []);

  return null;
}
