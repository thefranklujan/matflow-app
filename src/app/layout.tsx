import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/context/CartContext";
import PWAInit from "@/components/PWAInit";
import OneSignalInit from "@/components/OneSignalInit";
import NativeSessionBridge from "@/components/NativeSessionBridge";
import NotificationBadgeSync from "@/components/NotificationBadgeSync";
import LaunchAnimation from "@/components/LaunchAnimation";
import { Toaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MatFlow",
  description: "Gym management platform for Jiu Jitsu academies",
  manifest: "/manifest.json",
  themeColor: "#c4b5a0",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MatFlow",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}>
        <CartProvider>
          <main className="flex-1">{children}</main>
        </CartProvider>
        <LaunchAnimation />
        <PWAInit />
        <OneSignalInit />
        <NativeSessionBridge />
        <NotificationBadgeSync />
        <Toaster
          theme="dark"
          position="top-right"
          richColors
          closeButton
          toastOptions={{
            style: {
              background: "#0a0a0a",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#fff",
            },
          }}
        />
      </body>
    </html>
  );
}
