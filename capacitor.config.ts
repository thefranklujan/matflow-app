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
      // LaunchScreen.storyboard is now a plain black rectangle — the
      // branded animation plays in the web view once it loads. Keep the
      // native splash on just long enough to cover the webview handoff,
      // with a fast fade so the transition into the JS animation is
      // invisible to the user.
      launchShowDuration: 0,
      launchAutoHide: true,
      launchFadeOutDuration: 200,
      backgroundColor: "#0a0a0a",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
