import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.craftedsystems.matflow",
  appName: "MatFlow",
  // Point directly at the live Next.js deployment — the native shell is a
  // thin wrapper around the already-working PWA, mirroring 37signals' Hotwire
  // Native pattern. This means web pushes to main = instant app update, no
  // App Store review needed for UI changes.
  server: {
    url: "https://app.mymatflow.com",
    cleartext: false,
    androidScheme: "https",
  },
  ios: {
    contentInset: "always",
    backgroundColor: "#0a0a0a",
    webContentsDebuggingEnabled: true,
  },
  android: {
    backgroundColor: "#0a0a0a",
    webContentsDebuggingEnabled: true,
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1000,
      backgroundColor: "#0a0a0a",
      showSpinner: false,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
