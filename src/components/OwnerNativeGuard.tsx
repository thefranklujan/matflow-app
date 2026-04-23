"use client";

import { useEffect } from "react";

/**
 * Blocks gym owner access to the /app dashboard when the MatFlow iOS
 * Capacitor shell is running. Per App Store Guideline 3.1.1, paid
 * gym owner subscription functionality purchased outside the app cannot
 * be accessed inside the iOS app without In-App Purchase. We keep the
 * owner dashboard web only. Students and the community use the app
 * normally.
 *
 * Web runs are no-ops: Capacitor is undefined in normal browsers, so
 * gym owners still hit the full dashboard at app.mymatflow.com.
 */
export default function OwnerNativeGuard() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const isNative =
      (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } })
        .Capacitor?.isNativePlatform?.() || false;
    if (!isNative) return;
    // Owner dashboard is not available in the iOS shell; send them to
    // the web only landing page.
    window.location.replace("/native-web-only");
  }, []);

  return null;
}
